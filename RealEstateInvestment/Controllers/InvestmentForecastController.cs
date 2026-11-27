using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Services.Forecast;

namespace RealEstateInvestment.Controllers;

[ApiController]
[Authorize]
[Route("api/properties/{propertyId:guid}/investment-forecast")]
public sealed class InvestmentForecastController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ForecastResponse>> Calculate(Guid propertyId, ForecastRequest request, CancellationToken ct)
    {
        var property = await db.Properties.AsNoTracking().Include(p => p.PaymentPlans)
            .SingleOrDefaultAsync(p => p.Id == propertyId && p.Status != "declined", ct);
        if (property is null) return NotFound();
        if (property.TotalShares > 0 && request.Shares > property.TotalShares)
        {
            ModelState.AddModelError("shares", "Shares cannot exceed the total shares of the property.");
            return ValidationProblem(ModelState);
        }

        return InvestmentForecast.Calculate(property, request, request.AsOf ?? DateOnly.FromDateTime(DateTime.UtcNow));
    }
}
