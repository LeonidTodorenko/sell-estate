using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
 
namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/admin/investments")]
    public class AdminInvestmentController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminInvestmentController(AppDbContext context)
        {
            _context = context;
        }

        // Get a list of all investments
        [HttpGet]
        public async Task<IActionResult> GetAllInvestments()
        {
            var investments = await _context.Investments.ToListAsync();
            return Ok(investments);
        }

        // Approve investment
        [HttpPost("{id}/approve")]
        public async Task<IActionResult> ApproveInvestment(Guid id)
        {
            var investment = await _context.Investments.FindAsync(id);
            if (investment == null) return NotFound(new { message = "Investment not found" });

            // Тут можно добавить логику подтверждения платежа
            await _context.SaveChangesAsync();
            return Ok(new { message = "Investment approved" });
        }

        // Reject investment
        [HttpPost("{id}/reject")]
        public async Task<IActionResult> RejectInvestment(Guid id)
        {
            var investment = await _context.Investments.FindAsync(id);
            if (investment == null) return NotFound(new { message = "Investment not found" });

            _context.Investments.Remove(investment);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Investment rejected" });
        }
    }
}
