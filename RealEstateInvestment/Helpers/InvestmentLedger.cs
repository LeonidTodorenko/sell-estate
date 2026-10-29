using System.Text.Json;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Helpers;

// Stages both journals in the caller's wallet/ownership transaction. No independent SaveChanges.
internal static class InvestmentLedger
{
    public static void Record(AppDbContext db, Guid actor, Guid affectedUser, Property property,
        decimal amount, int shares, TransactionType type, string action, string context, Guid? operationId = null, Guid? sourceId = null)
    {
        if (db.Database.CurrentTransaction == null)
            throw new InvalidOperationException("Investment ledger requires a financial transaction");
        if (amount < 0 || shares < 0) throw new InvalidOperationException("Invalid investment accounting amount");
        if (amount == 0) return; // No cash movement; do not invent a financial entry.
        var id = operationId ?? Guid.NewGuid();
        var now = DateTime.UtcNow;
        db.UserTransactions.Add(new UserTransaction
        {
            Id = id, UserId = affectedUser, Type = type, Amount = amount, Shares = shares,
            PropertyId = property.Id, PropertyTitle = property.Title, Timestamp = now, Notes = context
        });
        db.ActionLogs.Add(new ActionLog
        {
            UserId = actor, Action = action, Timestamp = now,
            // Allowlist only identifiers and accounting data. Guid.Empty denotes the scheduler.
            Details = JsonSerializer.Serialize(new
            {
                eventType = type == TransactionType.Investment ? "investment.debit" : "investment.refund.credit",
                actor = actor == Guid.Empty ? "scheduler" : actor.ToString(),
                affectedUser, propertyId = property.Id, amount, shares, transactionId = id, sourceId, operationContext = context
            })
        });
    }
}
