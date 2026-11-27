using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services.Forecast;

namespace RealEstateInvestment.Services.Assistant;

public sealed record ForecastRateApproval(GrowthScenarios Rates, string Source, DateOnly AsOf);

internal static class ForecastRateJournal
{
    private static string Action(Guid? propertyId) => $"ForecastRateApproval:{propertyId?.ToString("N") ?? "global"}";

    internal static async Task<ForecastRateApproval?> ReadAsync(AppDbContext db, Guid? propertyId, CancellationToken ct)
    {
        var action = Action(propertyId);
        var latest = await db.ActionLogs.AsNoTracking().Where(row => row.Action == action)
            .OrderByDescending(row => row.Timestamp).ThenByDescending(row => row.Id)
            .Select(row => row.Details).FirstOrDefaultAsync(ct);
        return latest is null ? null : JsonSerializer.Deserialize<ForecastRateApproval>(latest);
    }

    internal static void Add(AppDbContext db, Guid? propertyId, Guid admin, ForecastRateApproval approval) =>
        db.ActionLogs.Add(new ActionLog { UserId = admin, Action = Action(propertyId), Details = JsonSerializer.Serialize(approval) });

    internal static bool IsCurrent(ForecastRateApproval? approval, DateOnly today) =>
        approval is not null && today >= approval.AsOf && today.DayNumber - approval.AsOf.DayNumber <= 31;
}
