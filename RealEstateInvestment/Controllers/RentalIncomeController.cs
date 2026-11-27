using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Services;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [FinancialConcurrency]
    [Authorize]
    [Route("api/rentals")]
    public class RentalIncomeController : ControllerBase
    {
        private readonly AppDbContext _context;
        public RentalIncomeController(AppDbContext context) => _context = context;

        [HttpPost("payout/{propertyId}")]
        [FinancialAdmin]
        public Task<IActionResult> ProcessRentalPayout(Guid propertyId, [FromServices] RentalPayoutService payout) =>
            payout.PayAsync(propertyId, null, User.GetUserId());

        /// <summary>
        /// История выплат инвестору (старый метод, оставляем как есть, только сумма теперь net)
        /// </summary>
        [HttpGet("investor/{userId}")]
        public async Task<IActionResult> GetInvestorPayouts(Guid userId)
        {
            if (await PrivateDataAccess.RequireOwnerAsync(User, _context, userId, HttpContext.RequestServices.GetRequiredService<IConfiguration>(), allowAdmin: true) is { } accessError) return accessError;

            if (User.IsDemo())
            {
                userId = User.ResolveRequestedUserId(userId);
                if (userId == Guid.Empty) return Unauthorized();
                return Ok(await _context.DemoRentalIncomes.AsNoTracking()
                    .Where(p => p.DemoInvestorId == userId)
                    .OrderByDescending(p => p.PayoutDate)
                    .Select(p => new { p.Id, p.PropertyId, InvestorId = p.DemoInvestorId, p.Amount, p.PayoutDate })
                    .ToListAsync());
            }

            var payouts = await _context.RentalIncomes
                .Where(p => p.InvestorId == userId)
                .OrderByDescending(p => p.PayoutDate)
                .ToListAsync();

            return Ok(payouts);
        }
    }
}
