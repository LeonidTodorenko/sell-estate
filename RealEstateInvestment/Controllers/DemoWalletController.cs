using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/demo/wallet")]
    public class DemoWalletController : ControllerBase
    {
        public const decimal MaxTopUpAmount = 100_000m;

        private readonly AppDbContext _context;

        public DemoWalletController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("topup")]
        public async Task<IActionResult> TopUp([FromBody] DemoTopUpRequest request)
        {
            if (!User.IsDemo())
                return Forbid();

            var demoUserId = User.GetUserId();
            if (demoUserId == Guid.Empty)
                return Unauthorized(new { message = "Invalid demo identity" });

            if (request.Amount <= 0 || request.Amount > MaxTopUpAmount)
                return BadRequest(new { message = $"Amount must be greater than 0 and no more than {MaxTopUpAmount:0} USD" });

            await using var transaction = await _context.Database.BeginTransactionAsync();
            var demoUser = await _context.DemoUsers.FirstOrDefaultAsync(x => x.Id == demoUserId);
            if (demoUser == null)
                return NotFound(new { message = "Demo account not found" });

            var now = DateTime.UtcNow;
            if (!demoUser.IsActive || demoUser.IsBlocked || demoUser.IsDeleted == true ||
                (demoUser.ExpiresAt.HasValue && demoUser.ExpiresAt.Value <= now))
                return Unauthorized(new { message = "Demo account is inactive or expired" });

            demoUser.WalletBalance += request.Amount;
            demoUser.LastActiveAt = now;

            _context.DemoUserTransactions.Add(new DemoUserTransaction
            {
                DemoUserId = demoUserId,
                Type = TransactionType.Deposit,
                Amount = request.Amount,
                Timestamp = now,
                Notes = "Simulated demo wallet top-up"
            });

            _context.DemoActionLogs.Add(new DemoActionLog
            {
                DemoUserId = demoUserId,
                Action = "TopUp",
                Details = $"Simulated wallet top-up: {request.Amount:F2} USD",
                Timestamp = now
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                message = "Virtual funds added",
                amount = request.Amount,
                walletBalance = demoUser.WalletBalance,
                isDemo = true
            });
        }

        public sealed class DemoTopUpRequest
        {
            public decimal Amount { get; set; }
        }
    }
}
