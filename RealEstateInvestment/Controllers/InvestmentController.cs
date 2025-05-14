using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/investments")]
    public class InvestmentController : ControllerBase
    {
        private readonly AppDbContext _context;
        private static readonly SemaphoreSlim _investmentLock = new(1, 1);

        public InvestmentController(AppDbContext context)
        {
            _context = context;
        }

        //   An investor submits an application to purchase shares
        [HttpPost("apply")]
        public async Task<IActionResult> ApplyForInvestment([FromBody] InvestmentWithPin investmentRequest)
        {
            await _investmentLock.WaitAsync();
            try
            {
                var property = await _context.Properties.FindAsync(investmentRequest.PropertyId);
                if (property == null) return NotFound(new { message = "Object not found" });

                if (DateTime.UtcNow > property.ApplicationDeadline)
                    return BadRequest(new { message = "The application deadline has expired" });

                var user = await _context.Users.FindAsync(investmentRequest.UserId);
                if (user == null)
                    return NotFound(new { message = "User not found" });

                if (!string.IsNullOrEmpty(user.PinCode))
                {
                    if (investmentRequest.PinOrPassword != user.PinCode)
                        return BadRequest(new { message = "Invalid PIN" });
                }
                else
                {
                    if (investmentRequest.PinOrPassword != user.PasswordHash) // TODO: hash
                        return BadRequest(new { message = "Invalid password" });
                }

                if (user.WalletBalance < investmentRequest.InvestedAmount)
                    return BadRequest(new { message = "Insufficient funds" });

                if (property.AvailableShares < investmentRequest.Shares)
                    return BadRequest(new { message = "Not enough free shares" });

                // spending money
                user.WalletBalance -= investmentRequest.InvestedAmount;

                // shares
                property.AvailableShares -= investmentRequest.Shares;

                // If an investor offers to pay the Upfront Payment, they will receive priority
                if (investmentRequest.InvestedAmount >= property.UpfrontPayment)
                {
                    property.PriorityInvestorId = investmentRequest.UserId;
                }

                // Save the application
                _context.Investments.Add(investmentRequest);
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = investmentRequest.UserId,
                    Action = "ApplyForInvestment KycDocument",
                    Details = "Apply For Investment Shares: " + investmentRequest.Shares + "; InvestedAmount: " + investmentRequest.InvestedAmount + "; PropertyId: " + investmentRequest.PropertyId
                });
                await _context.SaveChangesAsync();
                return Ok(new { message = "The application has been submitted" });
            }
            finally
            {
                _investmentLock.Release();
            }

            // todo
            //Сделать статус Investment.Status = pending / confirmed и использовать это при финализации.
            //Добавить логику возврата денег при FinalizeInvestment, если заявка не попала в распределение.
            //В будущем: уведомления, e - mail, журнал транзакций.
        }

        // todo move
        public class InvestmentWithPin : Investment
        {
            public string PinOrPassword { get; set; }
        }

        // Completing the share purchase process (used after the bid period expires)
        [HttpPost("finalize/{propertyId}")]
        public async Task<IActionResult> FinalizeInvestment(Guid propertyId)
        {
            var property = await _context.Properties.FindAsync(propertyId);
            if (property == null) return NotFound(new { message = "Object not found" });

            if (DateTime.UtcNow < property.ApplicationDeadline)
                return BadRequest(new { message = "The deadline for applications has not yet expired" });

            var priorityInvestor = await _context.Investments
                .Where(i => i.PropertyId == propertyId && i.UserId == property.PriorityInvestorId)
                .FirstOrDefaultAsync();

            if (priorityInvestor != null)
            {
                // The priority investor buys out all available shares
                property.AvailableShares = 0;
            }
            else
            {
                // todo check - Property cannot be finalized until at least 40% of the payment plan is paid
                var paymentPlans = await _context.PaymentPlans
                    .Where(p => p.PropertyId == propertyId)
                    .ToListAsync();
                if (paymentPlans.Count > 0)
                {
                    var totalDue = paymentPlans.Sum(p => p.Total);
                    var totalPaid = paymentPlans.Sum(p => p.Paid);
                    var paidPercentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

                    if (paidPercentage < 40)
                    {
                        return BadRequest(new { message = "Property cannot be finalized until at least 40% of the payment plan is paid" });
                    }
                }

                //
                // добавить внутреннюю биржу 
                // переделать на дату подачи - если только один не перекрыл всю сумму (сумма для старта, сумма пеймент плана, у админа есть возможность повысить стоимость объекта но shares остаются прежними  у тех кто купил первыми, добавить дату сдачи дома ожидаемую, добавить возможность выставлять объект с определенным числом SHARES , допустим распредление раз в месяц происходит)
                // If no one has made an Upfront Payment, shares are distributed among applications
                var investments = await _context.Investments
                    .Where(i => i.PropertyId == propertyId)
                    .OrderByDescending(i => i.InvestedAmount) // The higher the amount, the higher the chance of getting shares
                    .ToListAsync();

                foreach (var investment in investments)
                {
                    if (property.AvailableShares == 0) break;

                    int allocatedShares = Math.Min(investment.Shares, property.AvailableShares);
                    investment.Shares = allocatedShares;
                    property.AvailableShares -= allocatedShares;
                }
            }

            property.Status = "sold";
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                Action = "FinalizeInvestment",
                Details = "Finalize Investment propertyId: " + propertyId.ToString()
            });
            await _context.SaveChangesAsync();
            return Ok(new { message = "Investments distributed" });
        }

        [HttpPost("validate-payments/{propertyId}")]
        public async Task<IActionResult> ValidateInitialPayment(Guid propertyId)
        {
            var property = await _context.Properties.FindAsync(propertyId);
            if (property == null) return NotFound(new { message = "Property not found" });

            var firstPayment = await _context.PaymentPlans
                .Where(p => p.PropertyId == propertyId)
                .OrderBy(p => p.DueDate)
                .FirstOrDefaultAsync();

            if (firstPayment == null)
                return BadRequest(new { message = "No payment plan found" });

            if (DateTime.UtcNow < firstPayment.DueDate)
                return BadRequest(new { message = "It's too early to validate payments" });

            var totalInvested = await _context.Investments
                .Where(i => i.PropertyId == propertyId)
                .SumAsync(i => i.InvestedAmount);

            if (totalInvested < firstPayment.Total)
            {
                // Отзываем все заявки
                var investments = await _context.Investments
                    .Where(i => i.PropertyId == propertyId)
                    .ToListAsync();

                foreach (var inv in investments)
                {
                    var user = await _context.Users.FindAsync(inv.UserId);
                    if (user != null)
                    {
                        user.WalletBalance += inv.InvestedAmount;
                        property.AvailableShares += inv.Shares;

                        _context.ActionLogs.Add(new ActionLog
                        {
                            UserId = inv.UserId,
                            Action = "InvestmentRevoked",
                            Details = $"Investment {inv.Id} was revoked due to unpaid first milestone"
                        });
                    }
                }

                _context.Investments.RemoveRange(investments);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Investments revoked: not enough funds for first milestone" });
            }

            return Ok(new { message = "First milestone is covered, no action needed" });
        }


        // Get user investments
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserInvestments(Guid userId)
        {
            var investments = await _context.Investments
                .Where(i => i.UserId == userId)
                .ToListAsync();

            return Ok(investments);
        }

        [HttpGet("all")]
        public async Task<IActionResult> GetAllInvestments()
        {
            var result = await (
                from i in _context.Investments
                join u in _context.Users on i.UserId equals u.Id
                join p in _context.Properties on i.PropertyId equals p.Id
                orderby i.CreatedAt descending
                select new
                {
                    InvestmentId = i.Id,
                    UserId = u.Id,
                    UserName = u.FullName,
                    PropertyName = p.Title,
                    i.Shares,
                    i.InvestedAmount,
                    i.CreatedAt
                }
            ).ToListAsync();

            return Ok(result);
        }

        [HttpGet("kyc/pending")]
        public async Task<IActionResult> GetUsersWithPendingKyc()
        {
            var users = await _context.Users
                .Where(u => u.KycStatus == "pending")
                .OrderBy(u => u.CreatedAt)
                .ToListAsync();

            return Ok(users);
        }

        [HttpPost("{id}/kyc/verify")]
        public async Task<IActionResult> VerifyKyc(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.KycStatus = "verified";
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                Action = "VerifyKyc",
                Details = "Verify Kyc id: " + id.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "User KYC verified" });
        }

        [HttpPost("{id}/kyc/reject")]
        public async Task<IActionResult> RejectKyc(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.KycStatus = "rejected";
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                Action = "RejectKyc",
                Details = "Reject Kyc id: " + id.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "User KYC rejected" });
        }

        // summing up investments
        [HttpGet("with-aggregated/{userId}")]
        public async Task<IActionResult> GetUserAggregatedInvestments(Guid userId)
        {
            var result = await (
                from i in _context.Investments
                join p in _context.Properties on i.PropertyId equals p.Id
                where i.UserId == userId
                group new { i, p } by new { i.PropertyId, p.Title, p.Price } into g
                select new
                {
                    PropertyId = g.Key.PropertyId,
                    PropertyTitle = g.Key.Title,
                    TotalShares = g.Sum(x => x.i.Shares),
                    TotalInvested = g.Sum(x => x.i.InvestedAmount),
                    FirstInvestmentDate = g.Min(x => x.i.CreatedAt),
                    OwnershipPercent = Math.Round(g.Sum(x => x.i.InvestedAmount) / g.Key.Price * 100, 2)
                }
            ).ToListAsync();

            return Ok(result);
        }

        //   without summing up investments
        [HttpGet("with-details/{userId}")]
        public async Task<IActionResult> GetUserInvestmentsWithDetails(Guid userId)
        {
            var result = await (
                from i in _context.Investments
                join p in _context.Properties on i.PropertyId equals p.Id
                where i.UserId == userId
                select new
                {
                    InvestmentId = i.Id,
                    PropertyId = p.Id,
                    PropertyTitle = p.Title,
                    i.Shares,
                    i.InvestedAmount,
                    i.CreatedAt,
                    Percent = Math.Round(i.InvestedAmount / p.Price * 100, 2)
                }
            ).ToListAsync();

            return Ok(result);
        }

        [HttpDelete("{investmentId}")]
        public async Task<IActionResult> DeleteInvestment(Guid investmentId)
        {
            var investment = await _context.Investments.FindAsync(investmentId);
            if (investment == null)
                return NotFound(new { message = "Investment not found" });

            var user = await _context.Users.FindAsync(investment.UserId);
            var property = await _context.Properties.FindAsync(investment.PropertyId);

            if (user == null || property == null)
                return BadRequest(new { message = "Related user or property not found" });

            if (property.Status == "sold")
                return BadRequest(new { message = "Cannot cancel investment. Property is already sold." });

            if (DateTime.UtcNow > property.ApplicationDeadline)
                return BadRequest(new { message = "Cannot cancel investment after the application deadline." });


            // Refund to the user
            user.WalletBalance += investment.InvestedAmount;

            // Returning shares back to the property
            property.AvailableShares += investment.Shares;

            _context.Investments.Remove(investment);
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                Action = "DeleteInvestment",
                Details = "Delete Investment investmentId: " + investmentId.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Investment cancelled and funds returned" });

            // todo Защиту от удаления после дедлайна или финализации - убрать это и на ui
        }



    }
}
