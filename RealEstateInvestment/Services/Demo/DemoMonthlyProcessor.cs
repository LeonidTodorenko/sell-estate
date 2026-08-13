using System.Data;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Services.Demo;

public sealed class DemoMonthlyProcessor : IDemoMonthlyProcessor
{
    private readonly AppDbContext _db;
    private readonly ILogger<DemoMonthlyProcessor> _logger;

    public DemoMonthlyProcessor(AppDbContext db, ILogger<DemoMonthlyProcessor> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task ProcessCurrentMonthAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var payoutMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var eligibleUserIds = await _db.DemoUsers
            .AsNoTracking()
            .Where(user => !user.IsTemplate
                && user.IsActive
                && !user.IsBlocked
                && user.IsDeleted != true
                && (user.ExpiresAt == null || user.ExpiresAt > now))
            .Select(user => user.Id)
            .ToListAsync(cancellationToken);

        _logger.LogInformation(
            "Demo monthly payout started for {PayoutMonth}; {EligibleUserCount} eligible demo users",
            payoutMonth,
            eligibleUserIds.Count);

        var paidUsers = 0;
        var paidProperties = 0;
        var totalPaid = 0m;

        foreach (var userId in eligibleUserIds)
        {
            try
            {
                var result = await ProcessUserAsync(userId, payoutMonth, cancellationToken);
                if (result.PropertyCount == 0)
                    continue;

                paidUsers++;
                paidProperties += result.PropertyCount;
                totalPaid += result.Amount;
            }
            catch (DbUpdateException exception)
            {
                _db.ChangeTracker.Clear();
                _logger.LogWarning(
                    exception,
                    "Demo monthly payout for user {DemoUserId} and {PayoutMonth} was skipped after a concurrent/idempotency conflict",
                    userId,
                    payoutMonth);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _db.ChangeTracker.Clear();
                _logger.LogError(
                    exception,
                    "Demo monthly payout failed for user {DemoUserId} and {PayoutMonth}; other demo users will continue",
                    userId,
                    payoutMonth);
            }
        }

        _logger.LogInformation(
            "Demo monthly payout finished for {PayoutMonth}: {PaidUsers} users, {PaidProperties} properties, {TotalPaid} USD",
            payoutMonth,
            paidUsers,
            paidProperties,
            totalPaid);
    }

    private async Task<PayoutResult> ProcessUserAsync(
        Guid userId,
        DateTime payoutMonth,
        CancellationToken cancellationToken)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        var now = DateTime.UtcNow;
        var user = await _db.DemoUsers.SingleOrDefaultAsync(
            candidate => candidate.Id == userId
                && !candidate.IsTemplate
                && candidate.IsActive
                && !candidate.IsBlocked
                && candidate.IsDeleted != true
                && (candidate.ExpiresAt == null || candidate.ExpiresAt > now),
            cancellationToken);

        if (user is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return default;
        }

        // Property is shared reference data. It is read only here; no Property entity is tracked.
        var investments = await (
                from investment in _db.DemoInvestments.AsNoTracking()
                join property in _db.Properties.AsNoTracking()
                    on investment.PropertyId equals property.Id
                where investment.DemoUserId == userId
                    && investment.Shares > 0
                    && property.TotalShares > 0
                    && property.MonthlyRentalIncome > 0
                group investment by new
                {
                    investment.PropertyId,
                    property.Title,
                    property.TotalShares,
                    property.MonthlyRentalIncome
                }
                into grouped
                select new
                {
                    grouped.Key.PropertyId,
                    grouped.Key.Title,
                    grouped.Key.TotalShares,
                    grouped.Key.MonthlyRentalIncome,
                    Shares = grouped.Sum(item => item.Shares)
                })
            .ToListAsync(cancellationToken);

        if (investments.Count == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return default;
        }

        var propertyIds = investments.Select(item => item.PropertyId).ToList();
        var alreadyPaidPropertyIds = await _db.DemoRentalIncomes
            .AsNoTracking()
            .Where(income => income.DemoInvestorId == userId
                && propertyIds.Contains(income.PropertyId)
                && income.PayoutMonth == payoutMonth)
            .Select(income => income.PropertyId)
            .ToListAsync(cancellationToken);
        var alreadyPaid = alreadyPaidPropertyIds.ToHashSet();

        var propertyCount = 0;
        var userTotal = 0m;

        foreach (var investment in investments.Where(item => !alreadyPaid.Contains(item.PropertyId)))
        {
            var payout = Math.Round(
                investment.MonthlyRentalIncome / investment.TotalShares * investment.Shares,
                2);
            if (payout <= 0)
                continue;

            user.WalletBalance += payout;
            userTotal += payout;
            propertyCount++;

            _db.DemoRentalIncomes.Add(new DemoRentalIncome
            {
                DemoInvestorId = user.Id,
                PropertyId = investment.PropertyId,
                Amount = payout,
                PayoutDate = now,
                PayoutMonth = payoutMonth
            });

            _db.DemoUserTransactions.Add(new DemoUserTransaction
            {
                DemoUserId = user.Id,
                Type = TransactionType.RentIncome,
                Amount = payout,
                Shares = investment.Shares,
                PropertyId = investment.PropertyId,
                PropertyTitle = investment.Title,
                Timestamp = now,
                Notes = $"Demo monthly rental income for {payoutMonth:yyyy-MM}"
            });

            _db.DemoMessages.Add(new DemoMessage
            {
                DemoRecipientId = user.Id,
                Title = "Monthly rental income credited",
                Content = $"Virtual rental income of {payout:F2} USD for \"{investment.Title}\" was added to your demo wallet.",
                CreatedAt = now
            });

            _db.DemoActionLogs.Add(new DemoActionLog
            {
                DemoUserId = user.Id,
                Action = "DemoMonthlyRentPayout",
                Details = $"Demo rent for {investment.Title} ({investment.PropertyId}), period {payoutMonth:yyyy-MM}: "
                    + $"{investment.MonthlyRentalIncome:F2} / {investment.TotalShares} * {investment.Shares} = {payout:F2} USD",
                Timestamp = now
            });
        }

        if (propertyCount == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return default;
        }

        var investmentValue = await (
            from investment in _db.DemoInvestments.AsNoTracking()
            join property in _db.Properties.AsNoTracking() on investment.PropertyId equals property.Id
            where investment.DemoUserId == userId && investment.Shares > 0
            select property.TotalShares > 0
                ? property.Price / property.TotalShares * investment.Shares
                : investment.InvestedAmount).SumAsync(cancellationToken);
        var rentalIncome = await _db.DemoRentalIncomes.AsNoTracking()
            .Where(x => x.DemoInvestorId == userId)
            .SumAsync(x => x.Amount, cancellationToken) + userTotal;
        var totalCapital = user.WalletBalance + investmentValue;
        var report = await _db.DemoMonthlyReports.SingleOrDefaultAsync(
            x => x.DemoUserId == userId && x.ReportMonth == payoutMonth, cancellationToken);
        var previousCapital = await _db.DemoMonthlyReports.AsNoTracking()
            .Where(x => x.DemoUserId == userId && x.ReportMonth < payoutMonth)
            .OrderByDescending(x => x.ReportMonth)
            .Select(x => (decimal?)x.TotalCapital)
            .FirstOrDefaultAsync(cancellationToken);
        report ??= new DemoMonthlyReport { DemoUserId = userId, ReportMonth = payoutMonth };
        report.WalletBalance = user.WalletBalance;
        report.InvestmentValue = investmentValue;
        report.RentalIncome = rentalIncome;
        report.TotalCapital = totalCapital;
        report.CapitalChange = previousCapital.HasValue ? totalCapital - previousCapital.Value : 0m;
        report.GeneratedAt = now;
        if (_db.Entry(report).State == EntityState.Detached)
            _db.DemoMonthlyReports.Add(report);

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        _logger.LogInformation(
            "Demo monthly payout credited {Amount} USD to demo user {DemoUserId} for {PropertyCount} properties in {PayoutMonth}",
            userTotal,
            user.Id,
            propertyCount,
            payoutMonth);

        return new PayoutResult(propertyCount, userTotal);
    }

    private readonly record struct PayoutResult(int PropertyCount, decimal Amount);
}
