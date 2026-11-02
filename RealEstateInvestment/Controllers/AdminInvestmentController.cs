using RealEstateInvestment.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [FinancialAdmin]
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
            var investments = await _context.Investments.Select(i => new { i.Id, i.UserId, i.PropertyId, i.Shares, i.InvestedAmount, i.CreatedAt }).ToListAsync();
            return Ok(investments);
        }

        // Legacy endpoints bypass the financial ledger and are unsafe for reconciliation.
        [HttpPost("{id}/approve")]
        public IActionResult ApproveInvestment(Guid id) => StatusCode(StatusCodes.Status410Gone,
            new { message = "Use investment intent diagnostics and independent reconciliation. No financial change was made." });

        [HttpPost("{id}/reject")]
        public IActionResult RejectInvestment(Guid id) => StatusCode(StatusCodes.Status410Gone,
            new { message = "Deleting ownership without a reconciled financial refund is disabled. No financial change was made." });
    }
}
