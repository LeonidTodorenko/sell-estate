using System.Text.Json;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;
using RealEstateInvestment.Helpers;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [FinancialConcurrency]
    [Authorize]
    [Route("api/withdrawals")]
    public class WithdrawalController : ControllerBase
    {
        private readonly AppDbContext _context;

        public WithdrawalController(AppDbContext context)
        {
            _context = context;
        }

        public sealed record CreateRequest(decimal Amount, Guid? RequestKey, string? TestDestination);
        public sealed record ReviewRequest(string? Reason);

        [HttpPost("request")]
        public async Task<IActionResult> RequestWithdrawal([FromBody] CreateRequest input)
        {
            if (input.Amount <= 0 || decimal.Round(input.Amount, 2) != input.Amount)
                return BadRequest(new { message = "Enter a positive USD amount with up to two decimal places" });

            var userId = User.GetUserId();
            var destination = input.TestDestination;
            // The only accepted destination is a synthetic bank account alias.
            if (input.RequestKey == Guid.Empty || (input.RequestKey.HasValue && destination != "TEST-BANK-001") ||
                (!input.RequestKey.HasValue && destination != null))
                return BadRequest(new { message = "Use a request UUID and the TEST-BANK-001 destination" });

            var request = new WithdrawalRequest
            {
                UserId = userId,
                Amount = input.Amount,
                RequestKey = input.RequestKey,
                TestDestination = destination
            };

            await using var financialTransaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);

            if (await FinancialActor.ValidateAsync(User, _context) is { } actorError) return actorError;
            if (User.IsDemo())
            {
                var demoUserId = User.GetUserId();
                if (demoUserId == Guid.Empty) return Unauthorized();
                var demo = await _context.DemoUsers.FindAsync(demoUserId);
                if (!FinancialActor.IsEligible(demo)) return NotFound(new { message = "Demo user not found" });
                var transactionId = input.RequestKey is { } demoKey
                    ? new Guid(System.Security.Cryptography.SHA256.HashData(
                        System.Text.Encoding.UTF8.GetBytes($"withdrawal:{demoUserId:N}:{demoKey:N}")).AsSpan(0, 16))
                    : Guid.NewGuid();
                var existing = await _context.DemoUserTransactions.FindAsync(transactionId);
                if (existing != null)
                    return existing.DemoUserId == demoUserId && existing.Type == TransactionType.Withdrawal &&
                        existing.Amount == input.Amount
                        ? Ok(new { simulated = true, status = "simulated", transactionId, balance = demo.WalletBalance })
                        : Conflict(new { message = "Request key already used" });
                if (request.Amount > demo.WalletBalance) return BadRequest(new { message = "Insufficient demo funds" });
                demo.WalletBalance -= request.Amount;
                var tx = new DemoUserTransaction { Id = transactionId, DemoUserId = demoUserId, Type = TransactionType.Withdrawal, Amount = request.Amount, Notes = "Instant simulated withdrawal (Demo Mode)" };
                _context.DemoUserTransactions.Add(tx);
                _context.DemoActionLogs.Add(new DemoActionLog { DemoUserId = demoUserId, Action = "VirtualWithdrawal", Details = $"Instant simulated withdrawal: {request.Amount} USD" });
                await _context.SaveChangesAsync();
                await financialTransaction.CommitAsync();
                return Ok(new { message = "Virtual withdrawal completed instantly", simulated = true, status = "simulated", transactionId = tx.Id, balance = demo.WalletBalance });
            }
            if (request.RequestKey is { } key)
            {
                var previous = await _context.WithdrawalRequests.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.UserId == userId && x.RequestKey == key);
                if (previous != null)
                    return previous.Amount == request.Amount && previous.TestDestination == destination
                        ? Ok(previous)
                        : Conflict(new { message = "Request key already used for another withdrawal" });
            }

            var user = await _context.Users.FindAsync(request.UserId);
            if (user == null) return NotFound(new { message = "User not available" });
            if (request.Amount > user.WalletBalance) return BadRequest(new { message = "Insufficient funds" });

            user.WalletBalance -= request.Amount;
            _context.WithdrawalRequests.Add(request);
            AddAudit(request, "RequestWithdrawal");
            _context.UserTransactions.Add(new UserTransaction
            {
                Id = request.Id,
                UserId = userId,
                Type = TransactionType.Withdrawal,
                Amount = request.Amount,
                Timestamp = DateTime.UtcNow,
                Notes = $"TEST withdrawal reserved; request {request.Id}"
            });

            await _context.SaveChangesAsync();
            await financialTransaction.CommitAsync();
            return Ok(request);
        }

        [HttpPost("{id:guid}/approve")]
        [FinancialAdmin]
        public Task<IActionResult> ApproveWithdrawal(Guid id) => Resolve(id, "approved", null);

        [HttpPost("{id:guid}/reject")]
        [FinancialAdmin]
        public Task<IActionResult> RejectWithdrawal(Guid id,
            [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ReviewRequest? input) =>
            Resolve(id, "rejected", input?.Reason?.Trim());

        [HttpPost("{id:guid}/cancel")]
        public async Task<IActionResult> CancelWithdrawal(Guid id)
        {
            if (User.IsDemo()) return Forbid();
            if (await FinancialActor.ValidateAsync(User, _context) is { } error) return error;
            return await Resolve(id, "canceled", null);
        }

        private async Task<IActionResult> Resolve(Guid id, string status, string? reason)
        {
            await using var tx = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var request = await _context.WithdrawalRequests.FindAsync(id);
            if (request == null || (status == "canceled" && request.UserId != User.GetUserId())) return NotFound();
            if (request.Status != "pending") return Conflict(new { message = "Withdrawal already processed" });
            if (reason?.Length > 240 || (status == "rejected" && request.RequestKey.HasValue && string.IsNullOrEmpty(reason)))
                return BadRequest(new { message = "Provide a rejection reason of up to 240 characters" });

            request.Status = status;
            request.ProcessedBy = User.GetUserId();
            request.ProcessedAt = DateTime.UtcNow;
            request.RejectionReason = reason;
            if (status != "approved")
            {
                var user = await _context.Users.FindAsync(request.UserId);
                if (user == null) return Conflict(new { message = "Withdrawal owner is missing" });
                user.WalletBalance += request.Amount;
                _context.UserTransactions.Add(new UserTransaction
                {
                    UserId = request.UserId,
                    Type = TransactionType.WithdrawalRefund,
                    Amount = request.Amount,
                    Timestamp = request.ProcessedAt.Value,
                    Notes = $"TEST withdrawal refunded ({status}); request {id}"
                });
            }

            var action = status switch
            {
                "approved" => "ApproveWithdrawal",
                "rejected" => "RejectWithdrawal",
                _ => "CancelWithdrawal"
            };
            AddAudit(request, action);
            await _context.SaveChangesAsync();
            await tx.CommitAsync();
            return Ok(request);
        }

        private void AddAudit(WithdrawalRequest request, string action)
        {
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = User.GetUserId(),
                Action = action,
                Details = JsonSerializer.Serialize(new
                {
                    request.Id, request.UserId, request.Amount, request.Status, request.RejectionReason,
                    test = true
                })
            });
        }

        // Investor application history
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserWithdrawals(Guid userId)
        {
            if (await PrivateDataAccess.RequireOwnerAsync(User, _context, userId, HttpContext.RequestServices.GetRequiredService<IConfiguration>(), allowAdmin: true) is { } accessError) return accessError;

            if (User.IsDemo())
            {
                var demoUserId = User.GetUserId();
                if (demoUserId == Guid.Empty) return Unauthorized();
                var virtualWithdrawals = await _context.DemoUserTransactions.AsNoTracking()
                    .Where(x => x.DemoUserId == demoUserId && x.Type == TransactionType.Withdrawal)
                    .OrderByDescending(x => x.Timestamp)
                    .Select(x => new { x.Id, x.Amount, status = "simulated", createdAt = x.Timestamp, x.Notes })
                    .ToListAsync();
                return Ok(virtualWithdrawals);
            }
            var withdrawals = await _context.WithdrawalRequests
                .Where(w => w.UserId == userId)
                .OrderByDescending(w => w.CreatedAt)
                .ToListAsync();

            return Ok(withdrawals);
        }

        [HttpGet("all")]
        [FinancialAdmin]
        public async Task<IActionResult> GetAllWithdrawals()
        {
            var all = await _context.WithdrawalRequests
                .OrderByDescending(w => w.CreatedAt)
                .ToListAsync();

            return Ok(all);
        }
    }
}
