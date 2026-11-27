using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Services.Assistant;

namespace RealEstateInvestment.Controllers;

[ApiController]
[FinancialAdmin]
[Route("api/admin/forecast-rates")]
public sealed class ForecastRatesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Read(Guid? propertyId, CancellationToken ct)
    {
        var approval = await ForecastRateJournal.ReadAsync(db, propertyId, ct);
        return Ok(new { approval, current = ForecastRateJournal.IsCurrent(approval, DateOnly.FromDateTime(DateTime.UtcNow)) });
    }

    [HttpPut]
    public async Task<IActionResult> Approve(Guid? propertyId, ForecastRateApproval approval, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (approval.Rates is not { } rates || rates.Negative is < -100 or >= 0 || rates.Optimistic > 100 ||
            rates.Negative > rates.Base || rates.Base > rates.Optimistic ||
            string.IsNullOrWhiteSpace(approval.Source) || approval.Source.Trim().Length > 300 || AssistantPresentation.CleanText(approval.Source) is null ||
            !ForecastRateJournal.IsCurrent(approval, today))
            return BadRequest(new { message = "Enter ordered rates, a source and a date within the last 31 days." });

        if (propertyId is { } id && !await db.Properties.AnyAsync(p => p.Id == id && p.Status != "declined", ct))
            return NotFound();

        ForecastRateJournal.Add(db, propertyId, User.GetUserId(), approval with { Source = approval.Source.Trim() });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
