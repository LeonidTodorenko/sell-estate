using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Services.Demo;

public sealed record CreateDemoAccountRequest(string FullName, string Email, string Password,
    string? DemoCode = null, DateTime? ExpiresAt = null);

public interface IDemoAccountFactory
{
    Task<DemoUser> CreateFromTemplateAsync(CreateDemoAccountRequest request,
        CancellationToken cancellationToken = default);
    Task<DemoUser> ResetFromTemplateAsync(Guid demoUserId,
        CancellationToken cancellationToken = default);
}

public sealed class DemoAccountFactory : IDemoAccountFactory
{
    private readonly AppDbContext _db;
    private readonly IDemoTemplateSeeder _seeder;

    public DemoAccountFactory(AppDbContext db, IDemoTemplateSeeder seeder) => (_db, _seeder) = (db, seeder);

    public async Task<DemoUser> CreateFromTemplateAsync(CreateDemoAccountRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.FullName);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Email);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Password);
        var email = request.Email.Trim().ToLowerInvariant();
        var demoCode = string.IsNullOrWhiteSpace(request.DemoCode)
            ? $"DEMO-{Guid.NewGuid():N}"[..13].ToUpperInvariant()
            : request.DemoCode.Trim();
        if (await _db.DemoUsers.AnyAsync(x => x.Email == email, cancellationToken))
            throw new InvalidOperationException($"Demo user with email '{email}' already exists.");
        if (await _db.DemoUsers.AnyAsync(x => x.DemoCode == demoCode, cancellationToken))
            throw new InvalidOperationException($"Demo account with code '{demoCode}' already exists.");

        var template = await _seeder.EnsureTemplateExistsAsync(cancellationToken)
            ?? throw new InvalidOperationException("At least one Property is required to create the demo template.");
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var state = await LoadTemplateStateAsync(template.Id, cancellationToken);
        var now = DateTime.UtcNow;
        var account = new DemoUser
        {
            DemoCode = demoCode,
            FullName = request.FullName.Trim(), Email = email,
            PasswordHash = PasswordHasher.HashPassword(request.Password), SecretWord = template.SecretWord,
            Role = template.Role, UserRole = template.UserRole, Permissions = template.Permissions,
            KycStatus = template.KycStatus, WalletBalance = template.WalletBalance,
            Address = template.Address, AvatarBase64 = template.AvatarBase64,
            IsEmailConfirmed = true, ClientNumber = await UniqueClientNumber(cancellationToken),
            TermsAcceptedAt = now, TermsVersion = template.TermsVersion,
            IsTemplate = false, IsActive = true, CreatedAt = now, LastActiveAt = now,
            ExpiresAt = request.ExpiresAt
        };
        _db.DemoUsers.Add(account);
        AddTemplateState(account, template, state, now);
        _db.DemoActionLogs.Add(new DemoActionLog
        {
            DemoUserId = account.Id, Action = "DemoAccountCreated",
            Details = $"Cloned from template {template.DemoCode}.", Timestamp = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return account;
    }

    public async Task<DemoUser> ResetFromTemplateAsync(Guid demoUserId,
        CancellationToken cancellationToken = default)
    {
        var template = await _seeder.EnsureTemplateExistsAsync(cancellationToken)
            ?? throw new InvalidOperationException("At least one Property is required to reset a demo account.");
        var account = await _db.DemoUsers.SingleOrDefaultAsync(x => x.Id == demoUserId, cancellationToken)
            ?? throw new KeyNotFoundException("Demo account was not found.");
        if (account.IsTemplate)
            throw new InvalidOperationException("The demo template cannot be reset.");

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var state = await LoadTemplateStateAsync(template.Id, cancellationToken);

        await _db.DemoShareOfferBids.Where(x => x.DemoBidderId == account.Id || x.DemoOffer.DemoSellerId == account.Id)
            .ExecuteDeleteAsync(cancellationToken);
        await _db.DemoShareTransactions.Where(x => x.DemoBuyerId == account.Id || x.DemoSellerId == account.Id)
            .ExecuteDeleteAsync(cancellationToken);
        await _db.DemoShareOffers.Where(x => x.DemoSellerId == account.Id).ExecuteDeleteAsync(cancellationToken);
        await _db.DemoInvestments.Where(x => x.DemoUserId == account.Id).ExecuteDeleteAsync(cancellationToken);
        await _db.DemoInvestmentApplications.Where(x => x.DemoUserId == account.Id).ExecuteDeleteAsync(cancellationToken);
        await _db.DemoRentalIncomes.Where(x => x.DemoInvestorId == account.Id).ExecuteDeleteAsync(cancellationToken);
        await _db.DemoUserTransactions.Where(x => x.DemoUserId == account.Id).ExecuteDeleteAsync(cancellationToken);
        await _db.DemoKycDocuments.Where(x => x.DemoUserId == account.Id).ExecuteDeleteAsync(cancellationToken);
        await _db.DemoMessages.Where(x => x.DemoRecipientId == account.Id).ExecuteDeleteAsync(cancellationToken);
        await _db.DemoMonthlyReports.Where(x => x.DemoUserId == account.Id).ExecuteDeleteAsync(cancellationToken);
        await _db.DemoActionLogs.Where(x => x.DemoUserId == account.Id).ExecuteDeleteAsync(cancellationToken);

        var now = DateTime.UtcNow;
        account.Role = template.Role;
        account.UserRole = template.UserRole;
        account.Permissions = template.Permissions;
        account.KycStatus = template.KycStatus;
        account.IsBlocked = template.IsBlocked;
        account.WalletBalance = template.WalletBalance;
        account.PhoneNumber = template.PhoneNumber;
        account.Address = template.Address;
        account.AvatarBase64 = template.AvatarBase64;
        account.IsEmailConfirmed = template.IsEmailConfirmed;
        account.TermsAcceptedAt = now;
        account.TermsVersion = template.TermsVersion;
        account.KycContractSentAt = template.KycContractSentAt;
        account.KycContractVersion = template.KycContractVersion;
        account.LastActiveAt = now;
        account.IsDeleted = false;
        account.DeletedAt = null;

        AddTemplateState(account, template, state, now);
        _db.DemoActionLogs.Add(new DemoActionLog
        {
            DemoUserId = account.Id, Action = "DemoAccountReset",
            Details = $"Reset from template {template.DemoCode}.", Timestamp = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return account;
    }

    private void AddTemplateState(DemoUser account, DemoUser template, TemplateState state, DateTime now)
    {
        var investments = state.Investments;
        var applications = state.Applications;
        var rentals = state.Rentals;
        var userTransactions = state.UserTransactions;
        var documents = state.Documents;
        var messages = state.Messages;
        var offers = state.Offers;
        var bids = state.Bids;

        _db.DemoMonthlyReports.AddRange(state.MonthlyReports.Select(x => new DemoMonthlyReport
        {
            DemoUserId = account.Id,
            ReportMonth = MonthStart(Shift(x.ReportMonth, template.CreatedAt, now)),
            WalletBalance = x.WalletBalance,
            InvestmentValue = x.InvestmentValue,
            RentalIncome = x.RentalIncome,
            TotalCapital = x.TotalCapital,
            CapitalChange = x.CapitalChange,
            GeneratedAt = Shift(x.GeneratedAt, template.CreatedAt, now)
        }));

        var investmentMap = investments.ToDictionary(x => x.Id, _ => Guid.NewGuid());
        _db.DemoInvestments.AddRange(investments.Select(x => new DemoInvestment
        {
            Id = investmentMap[x.Id], DemoUserId = account.Id, PropertyId = x.PropertyId,
            Shares = x.Shares, InvestedAmount = x.InvestedAmount, CreatedAt = Shift(x.CreatedAt, template.CreatedAt, now)
        }));
        _db.DemoInvestmentApplications.AddRange(applications.Select(x => new DemoInvestmentApplication
        {
            DemoUserId = account.Id, PropertyId = x.PropertyId, RequestedAmount = x.RequestedAmount,
            RequestedShares = x.RequestedShares, ApprovedShares = x.ApprovedShares, ApprovedAmount = x.ApprovedAmount,
            Status = x.Status, IsPriority = x.IsPriority, StepNumber = x.StepNumber,
            CreatedAt = Shift(x.CreatedAt, template.CreatedAt, now)
        }));
        _db.DemoRentalIncomes.AddRange(rentals.Select(x => new DemoRentalIncome
        {
            DemoInvestorId = account.Id, PropertyId = x.PropertyId, Amount = x.Amount,
            PayoutDate = Shift(x.PayoutDate, template.CreatedAt, now),
            PayoutMonth = MonthStart(Shift(x.PayoutDate, template.CreatedAt, now))
        }));
        _db.DemoUserTransactions.AddRange(userTransactions.Select(x => new DemoUserTransaction
        {
            DemoUserId = account.Id, Type = x.Type, Amount = x.Amount, Shares = x.Shares,
            PropertyId = x.PropertyId, PropertyTitle = x.PropertyTitle, Notes = x.Notes,
            Timestamp = Shift(x.Timestamp, template.CreatedAt, now)
        }));
        _db.DemoKycDocuments.AddRange(documents.Select(x => new DemoKycDocument
        {
            DemoUserId = account.Id, Type = x.Type, Base64File = x.Base64File, Status = x.Status,
            UploadedAt = Shift(x.UploadedAt, template.CreatedAt, now)
        }));
        _db.DemoMessages.AddRange(messages.Select(x => new DemoMessage
        {
            DemoRecipientId = account.Id, Title = x.Title, Content = x.Content, IsRead = x.IsRead,
            CreatedAt = Shift(x.CreatedAt, template.CreatedAt, now)
        }));

        var offerMap = offers.ToDictionary(x => x.Id, _ => Guid.NewGuid());
        _db.DemoShareOffers.AddRange(offers.Select(x => new DemoShareOffer
        {
            Id = offerMap[x.Id], DemoSellerId = account.Id, PropertyId = x.PropertyId,
            DemoInvestmentId = x.DemoInvestmentId is Guid investmentId ? investmentMap.GetValueOrDefault(investmentId) : null,
            SharesForSale = x.SharesForSale, LockedInvestedAmount = x.LockedInvestedAmount,
            StartPricePerShare = x.StartPricePerShare, BuyoutPricePerShare = x.BuyoutPricePerShare,
            ExpirationDate = Shift(x.ExpirationDate, template.CreatedAt, now), IsActive = x.IsActive,
            CreatedAt = Shift(x.CreatedAt, template.CreatedAt, now)
        }));
        _db.DemoShareOfferBids.AddRange(bids.Select(x => new DemoShareOfferBid
        {
            DemoOfferId = offerMap[x.DemoOfferId],
            DemoBidderId = x.DemoBidderId == template.Id ? account.Id : x.DemoBidderId,
            BidPricePerShare = x.BidPricePerShare, Shares = x.Shares,
            CreatedAt = Shift(x.CreatedAt, template.CreatedAt, now)
        }));
        _db.DemoShareTransactions.AddRange(state.ShareTransactions.Select(x => new DemoShareTransaction
        {
            DemoBuyerId = x.DemoBuyerId == template.Id ? account.Id : x.DemoBuyerId,
            DemoSellerId = x.DemoSellerId == template.Id ? account.Id : x.DemoSellerId,
            PropertyId = x.PropertyId, Shares = x.Shares, PricePerShare = x.PricePerShare,
            Timestamp = Shift(x.Timestamp, template.CreatedAt, now)
        }));
    }

    private async Task<TemplateState> LoadTemplateStateAsync(Guid templateId, CancellationToken cancellationToken)
    {
        var offers = await _db.DemoShareOffers.AsNoTracking().Where(x => x.DemoSellerId == templateId).ToListAsync(cancellationToken);
        var offerIds = offers.Select(x => x.Id).ToList();
        return new TemplateState(
            await _db.DemoInvestments.AsNoTracking().Where(x => x.DemoUserId == templateId).ToListAsync(cancellationToken),
            await _db.DemoInvestmentApplications.AsNoTracking().Where(x => x.DemoUserId == templateId).ToListAsync(cancellationToken),
            await _db.DemoRentalIncomes.AsNoTracking().Where(x => x.DemoInvestorId == templateId).ToListAsync(cancellationToken),
            await _db.DemoUserTransactions.AsNoTracking().Where(x => x.DemoUserId == templateId).ToListAsync(cancellationToken),
            await _db.DemoKycDocuments.AsNoTracking().Where(x => x.DemoUserId == templateId).ToListAsync(cancellationToken),
            await _db.DemoMessages.AsNoTracking().Where(x => x.DemoRecipientId == templateId).ToListAsync(cancellationToken),
            await _db.DemoMonthlyReports.AsNoTracking().Where(x => x.DemoUserId == templateId).ToListAsync(cancellationToken),
            offers,
            await _db.DemoShareOfferBids.AsNoTracking().Where(x => offerIds.Contains(x.DemoOfferId)).ToListAsync(cancellationToken),
            await _db.DemoShareTransactions.AsNoTracking()
                .Where(x => x.DemoBuyerId == templateId || x.DemoSellerId == templateId).ToListAsync(cancellationToken));
    }

    private sealed record TemplateState(
        List<DemoInvestment> Investments,
        List<DemoInvestmentApplication> Applications,
        List<DemoRentalIncome> Rentals,
        List<DemoUserTransaction> UserTransactions,
        List<DemoKycDocument> Documents,
        List<DemoMessage> Messages,
        List<DemoMonthlyReport> MonthlyReports,
        List<DemoShareOffer> Offers,
        List<DemoShareOfferBid> Bids,
        List<DemoShareTransaction> ShareTransactions);

    private async Task<string> UniqueClientNumber(CancellationToken cancellationToken)
    {
        string value;
        do value = $"DEMO-{ClientNumberGenerator.Generate()}";
        while (await _db.DemoUsers.AnyAsync(x => x.ClientNumber == value, cancellationToken));
        return value;
    }

    private static DateTime Shift(DateTime value, DateTime origin, DateTime target) => target + (value - origin);

    private static DateTime MonthStart(DateTime value) =>
        new(value.Year, value.Month, 1, 0, 0, 0, DateTimeKind.Utc);
}
