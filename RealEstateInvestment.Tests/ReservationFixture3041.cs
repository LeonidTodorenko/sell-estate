using System.Text.Json;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Tests;

internal static class ReservationFixture3041
{
    // Legacy scheduler fixtures start AFTER reserve debit. Supply its immutable proof;
    // the fixture's opening balance is the already-debited balance.
    public static void Prove(AppDbContext db, InvestmentApplication a)
    {
        var id=Guid.NewGuid();
        db.UserTransactions.Add(new UserTransaction {Id=id,UserId=a.UserId,PropertyId=a.PropertyId,Type=TransactionType.Investment,Amount=a.RequestedAmount,Shares=a.RequestedShares,Notes="Fixture opening reservation"});
        db.ActionLogs.Add(new ActionLog {UserId=a.UserId,Action="ApplicateForInvestment",Details=JsonSerializer.Serialize(new {sourceId=a.Id,transactionId=id})});
    }
}
