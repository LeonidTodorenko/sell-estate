using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize(Roles = "admin")]
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

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later,
                Action = "ApproveInvestment",
                Details = "Approve Investment id: " + id.ToString()
            });
            
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
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later,
                Action = "RejectInvestment",
                Details = "Reject Investment id: " + id.ToString()
            });
            await _context.SaveChangesAsync();
            return Ok(new { message = "Investment rejected" });
        }
    }
}
