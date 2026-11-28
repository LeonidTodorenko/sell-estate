using System.Data;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Services;

public sealed class InvestorMonthlySnapshotService(AppDbContext db)
{
    // Record only the actual current state. Never reconstruct past valuation from today's prices.
    public async Task CaptureAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({userId.ToString()}))", cancellationToken);
        var now = DateTime.UtcNow;
        var month = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        await db.Database.ExecuteSqlInterpolatedAsync($@"SELECT 1 FROM ""Users"" WHERE ""Id"" = {userId} FOR UPDATE", cancellationToken);
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId && x.Role == "investor" && !x.IsBlocked, cancellationToken);
        if (user is null) return;
        var wallet = user.WalletBalance;
        var investment = await (from i in db.Investments.AsNoTracking()
            join p in db.Properties.AsNoTracking() on i.PropertyId equals p.Id
            where i.UserId == userId && i.Shares > 0
            select new CapitalPosition { Price = p.Price, TotalShares = p.TotalShares, Shares = i.Shares, MissingPriceValue = 0m }).SumAsync(CapitalSnapshotMath.Value, cancellationToken);
        var rent = await db.UserTransactions.AsNoTracking()
            .Where(x => x.UserId == userId && x.Type == TransactionType.RentIncome)
            .SumAsync(x => x.Amount, cancellationToken);
        var previous = await db.InvestorMonthlyReports.AsNoTracking().Where(x => x.UserId == userId && x.ReportMonth < month)
            .OrderByDescending(x => x.ReportMonth).Select(x => (decimal?)x.TotalCapital).FirstOrDefaultAsync(cancellationToken);
        var total = CapitalSnapshotMath.Total(wallet, investment);
        var change = previous.HasValue ? total - previous.Value : 0m;
        var id = Guid.NewGuid();
        // Database uniqueness and ON CONFLICT cover retries and concurrent server instances.
        await db.Database.ExecuteSqlInterpolatedAsync($@"
            INSERT INTO ""InvestorMonthlyReports""
            (""Id"", ""UserId"", ""ReportMonth"", ""WalletBalance"", ""InvestmentValue"", ""RentalIncome"", ""TotalCapital"", ""CapitalChange"", ""GeneratedAt"")
            VALUES ({id}, {userId}, {month}, {wallet}, {investment}, {rent}, {total}, {change}, {now})
            ON CONFLICT (""UserId"", ""ReportMonth"") DO NOTHING", cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}
