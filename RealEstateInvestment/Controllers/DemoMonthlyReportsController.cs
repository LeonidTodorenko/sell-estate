using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;

namespace RealEstateInvestment.Controllers;

[ApiController]
[Authorize]
[Route("api/demo/monthly-reports")]
public sealed class DemoMonthlyReportsController : ControllerBase
{
    private readonly AppDbContext _db;

    public DemoMonthlyReportsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetHistory(CancellationToken cancellationToken)
    {
        if (!User.IsDemo()) return Forbid();
        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Invalid demo identity" });

        var accountExists = await _db.DemoUsers.AsNoTracking().AnyAsync(x =>
            x.Id == userId && !x.IsTemplate && x.IsActive && !x.IsBlocked && x.IsDeleted != true
            && (x.ExpiresAt == null || x.ExpiresAt > DateTime.UtcNow), cancellationToken);
        if (!accountExists) return Unauthorized(new { message = "Demo account is inactive or expired" });

        var reports = await _db.DemoMonthlyReports.AsNoTracking()
            .Where(x => x.DemoUserId == userId)
            .OrderByDescending(x => x.ReportMonth)
            .Select(x => new
            {
                x.Id, x.ReportMonth, x.WalletBalance, x.InvestmentValue,
                x.RentalIncome, x.TotalCapital, x.CapitalChange, x.GeneratedAt
            })
            .ToListAsync(cancellationToken);
        return Ok(reports);
    }
}
