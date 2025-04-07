using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
 
namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/admin/stats")]
    public class AdminStatsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminStatsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetStats()
        {
            var investors = await _context.Users.CountAsync(u => u.Role == "investor");
            var totalInvestments = await _context.Investments.SumAsync(i => i.InvestedAmount);
            var totalProperties = await _context.Properties.CountAsync();
            var totalRentalIncome = await _context.RentalIncomes.SumAsync(r => (decimal?)r.Amount) ?? 0;
            var pendingWithdrawals = await _context.WithdrawalRequests.CountAsync(w => w.Status == "pending");
            var pendingKyc = await _context.Users.CountAsync(u => u.KycStatus == "pending");

            return Ok(new
            {
                investors,
                totalInvestments,
                totalProperties,
                totalRentalIncome,
                pendingWithdrawals,
                pendingKyc
            });
        }
    }

}
