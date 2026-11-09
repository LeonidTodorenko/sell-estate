using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Helpers;

internal static class InvestmentReservationProof
{
    // Used inside the caller's Serializable transaction, by both admin and scheduler.
    public static async Task<bool> Proven(AppDbContext db, InvestmentApplication a)
    {
        if (a.RequestedAmount <= 0 || a.RequestedShares <= 0 || a.ApprovedAmount != null || a.ApprovedShares != null) return false;
        var marker = $"\"sourceId\":\"{a.Id}\"";
        var logs = await db.ActionLogs.AsNoTracking().Where(x => x.Details.Contains(marker)).ToListAsync();
        var debits = new HashSet<Guid>();
        foreach (var log in logs)
        {
            try
            {
                using var json = JsonDocument.Parse(log.Details);
                var j = json.RootElement;
                if (j.GetProperty("sourceId").GetGuid() != a.Id) continue;
                if (j.TryGetProperty("eventType", out var kind) && kind.GetString() == "investment.refund.credit") return false;
                if (log.Action != "ApplicateForInvestment" || log.UserId != a.UserId) continue;
                var id = j.GetProperty("transactionId").GetGuid();
                if (await db.UserTransactions.AnyAsync(t => t.Id == id && t.Type == TransactionType.Investment &&
                    t.UserId == a.UserId && t.PropertyId == a.PropertyId && t.Amount == a.RequestedAmount && t.Shares == a.RequestedShares)) debits.Add(id);
            }
            catch (Exception e) when (e is JsonException or KeyNotFoundException or InvalidOperationException or FormatException) { }
        }
        if (debits.Count != 1) return false;
        // A source debit must never be reused as proof for a second reservation.
        var debitMarker = $"\"transactionId\":\"{debits.Single()}\"";
        var sources = await db.ActionLogs.AsNoTracking().Where(x => x.Action == "ApplicateForInvestment" && x.Details.Contains(debitMarker)).ToListAsync();
        return sources.All(x => x.Details.Contains(marker));
    }
}
