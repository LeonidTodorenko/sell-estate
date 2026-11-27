using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Globalization;
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
    public async Task<IActionResult> GetHistory([FromServices] IMemoryCache cache, CancellationToken cancellationToken)
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
        return Ok(reports.Select((report, index) =>
        {
            var previous = index + 1 < reports.Count ? reports[index + 1] : null;
            if (previous?.ReportMonth.AddMonths(1) != report.ReportMonth) previous = null;
            var commentary = cache.GetOrCreate(("demo-report-commentary-v1", userId, report, previous), entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
                if (previous is null) return "This snapshot records capital at month end. A prior consecutive snapshot is unavailable.";
                return $"Compared with the previous month: investment value {Change(report.InvestmentValue - previous.InvestmentValue)}, " +
                    $"wallet balance {Change(report.WalletBalance - previous.WalletBalance)}, " +
                    $"cumulative rental income {Change(report.RentalIncome - previous.RentalIncome)}.";
            });
            return new
            {
                report.Id, report.ReportMonth, report.WalletBalance, report.InvestmentValue, report.RentalIncome,
                report.TotalCapital, report.CapitalChange, report.GeneratedAt, Commentary = commentary
            };
        }).ToArray());

        static string Change(decimal amount) => amount == 0 ? "unchanged" :
            $"{(amount > 0 ? "increased" : "decreased")} by {Math.Abs(amount).ToString("0.00", CultureInfo.InvariantCulture)} USD";
    }
}
