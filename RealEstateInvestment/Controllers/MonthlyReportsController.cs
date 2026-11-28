using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;

namespace RealEstateInvestment.Controllers;

[ApiController]
[Authorize]
[Route("api/monthly-reports")]
public sealed class MonthlyReportsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> History(CancellationToken cancellationToken)
    {
        if (User.IsDemo()) return Forbid();
        var id = User.GetUserId();
        if (id == Guid.Empty) return Unauthorized();
        if (!await db.Users.AsNoTracking().AnyAsync(x => x.Id == id && x.Role == "investor" && !x.IsBlocked, cancellationToken)) return Forbid();
        var reports = await db.InvestorMonthlyReports.AsNoTracking().Where(x => x.UserId == id)
            .OrderByDescending(x => x.GeneratedAt).ToListAsync(cancellationToken);
        return Ok(reports.Select((r, index) => new {
            r.Id, ReportMonth = r.GeneratedAt, r.GeneratedAt, r.WalletBalance, r.InvestmentValue,
            r.RentalIncome, r.TotalCapital, r.CapitalChange,
            Commentary = RealEstateInvestment.Services.CapitalSnapshotMath.Commentary(index + 1 < reports.Count, false)
        }));
    }
}
