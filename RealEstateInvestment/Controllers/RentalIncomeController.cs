using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
 
namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/rentals")]
    public class RentalIncomeController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RentalIncomeController(AppDbContext context)
        {
            _context = context;
        }

        // Make payments to investors for rent
        [HttpPost("payout/{propertyId}")]
        public async Task<IActionResult> ProcessRentalPayout(Guid propertyId)
        {
            var property = await _context.Properties.FindAsync(propertyId);
            if (property == null) return NotFound(new { message = "Object not found" });

            if (DateTime.UtcNow.Subtract(property.LastPayoutDate).Days < 30)
                return BadRequest(new { message = "Payments have already been made this month." });

            var investments = await _context.Investments
                .Where(i => i.PropertyId == propertyId)
                .ToListAsync();

            if (!investments.Any())
                return BadRequest(new { message = "There are no investors for this property" });

            decimal totalShares = investments.Sum(i => i.Shares);
            decimal totalIncome = property.MonthlyRentalIncome;

            foreach (var investment in investments)
            {
                decimal investorIncome = (investment.Shares / totalShares) * totalIncome;

                var rentalIncome = new RentalIncome
                {
                    PropertyId = propertyId,
                    InvestorId = investment.UserId,
                    Amount = investorIncome
                };

                _context.RentalIncomes.Add(rentalIncome);
            }

            property.LastPayoutDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Payments to investors have been made" });
        }

        // Get investor payment history
        [HttpGet("investor/{userId}")]
        public async Task<IActionResult> GetInvestorPayouts(Guid userId)
        {
            var payouts = await _context.RentalIncomes
                .Where(p => p.InvestorId == userId)
                .ToListAsync();

            return Ok(payouts);
        }
    }
}
