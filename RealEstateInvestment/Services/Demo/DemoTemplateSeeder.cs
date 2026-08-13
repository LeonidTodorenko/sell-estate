using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Services.Demo;

public interface IDemoTemplateSeeder
{
    Task<DemoUser?> EnsureTemplateExistsAsync(CancellationToken cancellationToken = default);
}

public sealed class DemoTemplateSeeder : IDemoTemplateSeeder
{
    private readonly AppDbContext _db;
    private readonly ILogger<DemoTemplateSeeder> _logger;

    public DemoTemplateSeeder(AppDbContext db, ILogger<DemoTemplateSeeder> logger) =>
        (_db, _logger) = (db, logger);

    public async Task<DemoUser?> EnsureTemplateExistsAsync(CancellationToken cancellationToken = default)
    {
        var existing = await _db.DemoUsers.SingleOrDefaultAsync(x => x.IsTemplate, cancellationToken);
        if (existing is not null) return existing;

        var properties = await _db.Properties.AsNoTracking()
            .OrderByDescending(x => x.Status == "available")
            .ThenBy(x => x.CreatedAt)
            .Take(DemoTemplateDefaults.PropertyCount)
            .ToListAsync(cancellationToken);
        if (properties.Count == 0)
        {
            _logger.LogWarning("Demo template was not created because no Properties exist.");
            return null;
        }

        await using var dbTransaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var template = new DemoUser
        {
            DemoCode = DemoTemplateDefaults.TemplateCode,
            FullName = DemoTemplateDefaults.TemplateFullName,
            Email = DemoTemplateDefaults.TemplateEmail,
            PasswordHash = PasswordHasher.HashPassword(DemoTemplateDefaults.TemplatePassword),
            SecretWord = DemoTemplateDefaults.TemplateSecretWord,
            Role = "investor",
            UserRole = UserRole.Investor,
            KycStatus = "verified",
            WalletBalance = DemoTemplateDefaults.StartingWalletBalance,
            IsEmailConfirmed = true,
            ClientNumber = DemoTemplateDefaults.TemplateClientNumber,
            TermsAcceptedAt = now.AddDays(-30),
            TermsVersion = DemoTemplateDefaults.TermsVersion,
            IsTemplate = true,
            IsActive = false,
            CreatedAt = now.AddMonths(-4)
        };
        _db.DemoUsers.Add(template);

        var investments = properties.Select((property, index) => new DemoInvestment
        {
            DemoUserId = template.Id,
            PropertyId = property.Id,
            Shares = DemoTemplateDefaults.InvestmentShares[index],
            InvestedAmount = SharePrice(property) * DemoTemplateDefaults.InvestmentShares[index],
            CreatedAt = now.AddMonths(-(index + 1))
        }).ToList();
        _db.DemoInvestments.AddRange(investments);

        _db.DemoUserTransactions.Add(new DemoUserTransaction
        {
            DemoUserId = template.Id,
            Type = TransactionType.Deposit,
            Amount = DemoTemplateDefaults.StartingWalletBalance + investments.Sum(x => x.InvestedAmount),
            Timestamp = now.AddMonths(-4),
            Notes = "Initial demo funds"
        });
        _db.DemoUserTransactions.AddRange(investments.Select((investment, index) => new DemoUserTransaction
        {
            DemoUserId = template.Id, Type = TransactionType.Investment,
            Amount = -investment.InvestedAmount, Shares = investment.Shares,
            PropertyId = investment.PropertyId, PropertyTitle = properties[index].Location,
            Timestamp = investment.CreatedAt, Notes = "Demo investment confirmed"
        }));

        var primary = properties[0];
        for (var month = 3; month >= 1; month--)
        {
            var amount = Math.Round(primary.MonthlyRentalIncome * DemoTemplateDefaults.RentalMultipliers[3 - month], 2);
            var date = now.AddMonths(-month);
            _db.DemoRentalIncomes.Add(new DemoRentalIncome
            {
                DemoInvestorId = template.Id,
                PropertyId = primary.Id,
                Amount = amount,
                PayoutDate = date,
                PayoutMonth = new DateTime(date.Year, date.Month, 1, 0, 0, 0, DateTimeKind.Utc)
            });
            _db.DemoUserTransactions.Add(new DemoUserTransaction
            {
                DemoUserId = template.Id, Type = TransactionType.RentIncome, Amount = amount,
                PropertyId = primary.Id, PropertyTitle = primary.Location,
                Timestamp = date, Notes = "Demo rental income"
            });
        }

        var investmentValue = investments.Sum(x => x.InvestedAmount);
        var seededRent = Enumerable.Range(0, 3)
            .Sum(index => Math.Round(primary.MonthlyRentalIncome * DemoTemplateDefaults.RentalMultipliers[index], 2));
        var openingWallet = DemoTemplateDefaults.StartingWalletBalance - seededRent;
        var runningRent = 0m;
        for (var month = 3; month >= 0; month--)
        {
            if (month < 3)
                runningRent += Math.Round(primary.MonthlyRentalIncome * DemoTemplateDefaults.RentalMultipliers[2 - month], 2);
            var reportDate = now.AddMonths(-month);
            var walletBalance = openingWallet + runningRent;
            var totalCapital = walletBalance + investmentValue;
            _db.DemoMonthlyReports.Add(new DemoMonthlyReport
            {
                DemoUserId = template.Id,
                ReportMonth = new DateTime(reportDate.Year, reportDate.Month, 1, 0, 0, 0, DateTimeKind.Utc),
                WalletBalance = walletBalance,
                InvestmentValue = investmentValue,
                RentalIncome = runningRent,
                TotalCapital = totalCapital,
                CapitalChange = month == 3 ? 0m : Math.Round(primary.MonthlyRentalIncome * DemoTemplateDefaults.RentalMultipliers[2 - month], 2),
                GeneratedAt = reportDate
            });
        }

        var pendingProperty = properties[^1];
        var pendingShares = Math.Max(1, DemoTemplateDefaults.InvestmentShares[properties.Count - 1] / 2);
        _db.DemoInvestmentApplications.Add(new DemoInvestmentApplication
        {
            DemoUserId = template.Id, PropertyId = pendingProperty.Id,
            RequestedShares = pendingShares, RequestedAmount = SharePrice(pendingProperty) * pendingShares,
            Status = "pending", StepNumber = 1, CreatedAt = now.AddDays(-3)
        });
        _db.DemoKycDocuments.AddRange(Kyc(template.Id, "passport", now.AddMonths(-4)), Kyc(template.Id, "iban", now.AddMonths(-4).AddDays(1)));
        _db.DemoMessages.AddRange(
            Message(template.Id, "Welcome to Demo", "Your sandbox portfolio is ready.", now.AddMonths(-4)),
            Message(template.Id, "Investment confirmed", "Your demo investments were added.", now.AddMonths(-3)),
            Message(template.Id, "Rental income received", "The latest demo rent was credited.", now.AddMonths(-1)),
            Message(template.Id, "Monthly portfolio report", "Your demo portfolio report is available.", now.AddDays(-2)));

        var offerInvestment = investments[0];
        var price = SharePrice(primary);
        var offerShares = Math.Min(DemoTemplateDefaults.OfferShares, offerInvestment.Shares);
        var offer = new DemoShareOffer
        {
            DemoSellerId = template.Id, PropertyId = primary.Id, DemoInvestmentId = offerInvestment.Id,
            SharesForSale = offerShares, LockedInvestedAmount = price * offerShares,
            StartPricePerShare = Math.Round(price * DemoTemplateDefaults.OfferMarkup, 2),
            BuyoutPricePerShare = Math.Round(price * DemoTemplateDefaults.BuyoutMarkup, 2),
            ExpirationDate = now.AddDays(21), CreatedAt = now.AddDays(-2), IsActive = true
        };
        _db.DemoShareOffers.Add(offer);
        _db.DemoShareOfferBids.Add(new DemoShareOfferBid
        {
            DemoOfferId = offer.Id, DemoBidderId = template.Id,
            BidPricePerShare = Math.Round(price * DemoTemplateDefaults.BidMarkup, 2),
            Shares = 1, CreatedAt = now.AddDays(-1)
        });
        _db.DemoActionLogs.Add(new DemoActionLog
        {
            DemoUserId = template.Id, Action = "TemplateSeeded",
            Details = $"Created from {properties.Count} read-only properties.", Timestamp = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);
        return template;
    }

    private static decimal SharePrice(Property p) => p.TotalShares > 0 ? p.Price / p.TotalShares : p.Price;
    private static DemoKycDocument Kyc(Guid id, string type, DateTime at) =>
        new() { DemoUserId = id, Type = type, Base64File = string.Empty, Status = "approved", UploadedAt = at };
    private static DemoMessage Message(Guid id, string title, string content, DateTime at) =>
        new() { DemoRecipientId = id, Title = title, Content = content, CreatedAt = at };
}
