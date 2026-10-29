using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using Xunit;
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RealEstateInvestment.Enums;
using System.Net.Http.Json;
using RealEstateInvestment.Services.Demo;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Configuration;

namespace RealEstateInvestment.Tests;

[Collection("RestoredPostgres")]
public class Financial262CTests
{
    private static FinancialTestHost Host(IInterceptor? fault = null) => new(interceptor: fault, isolatedPostgres: Environment.GetEnvironmentVariable("QA262B_DB")!);
    private static Task Expire(FinancialTestHost h) => (Task)typeof(ScheduledTaskService)
        .GetMethod("RunExpiredShareOfferProcessing", BindingFlags.Instance | BindingFlags.NonPublic)!
        .Invoke(new ScheduledTaskService(h.Services, null!), null)!;
    private static Task Process(FinancialTestHost h, string name, params object[] args) => (Task)typeof(ScheduledTaskService)
        .GetMethod(name, BindingFlags.Instance | BindingFlags.NonPublic)!
        .Invoke(new ScheduledTaskService(h.Services, null!), args)!;

    private static void Reconcile(FinancialTestHost h, decimal actorOpening = 1000)
    {
        h.WithDb(db => {
            foreach (var id in new[] { h.Actor, h.Other, h.Admin }) {
                var delta = db.UserTransactions.Where(x => x.UserId == id).AsEnumerable().Sum(x => x.Type switch {
                    TransactionType.ShareMarketBuy or TransactionType.ShareMarketFee or TransactionType.CancelListingFee or TransactionType.Investment => -x.Amount,
                    TransactionType.ShareMarketSell or TransactionType.ClubFeeIncome or TransactionType.ReferralReward or TransactionType.InvestmentRefund => x.Amount,
                    _ => throw new InvalidOperationException($"Unexpected fixture transaction {x.Type}")
                });
                Assert.Equal((id == h.Actor ? actorOpening : 1000) + delta, db.Users.Find(id)!.WalletBalance);
            }
        });
    }

    [Local262BFact]
    public async Task Expiry_without_bids_returns_locked_shares_and_basis_once()
    {
        using var h = Host();
        h.WithDb(db => { db.ShareOffers.Find(h.Offer)!.ExpirationDate = DateTime.UtcNow.AddMinutes(-1); db.SaveChanges(); });
        await Expire(h); await Expire(h);
        Reconcile(h);
        h.WithDb(db => {
            Assert.Equal(2, db.Investments.Where(x => x.UserId == h.Other && x.PropertyId == h.PropertyId).Sum(x => x.Shares));
            Assert.Equal(20, db.Investments.Where(x => x.UserId == h.Other && x.PropertyId == h.PropertyId).Sum(x => x.InvestedAmount));
            var offer = db.ShareOffers.Find(h.Offer)!;
            Assert.False(offer.IsActive); Assert.Equal(0, offer.SharesForSale); Assert.Equal(0, offer.LockedInvestedAmount);
        });
    }

    [Local262BFact]
    public async Task Partial_expiry_preserves_remainder_and_records_cash_and_trade_once()
    {
        using var h = Host();
        h.WithDb(db => {
            db.ShareOffers.Find(h.Offer)!.ExpirationDate = DateTime.UtcNow.AddMinutes(-1);
            db.ShareOfferBids.Add(new ShareOfferBid { OfferId = h.Offer, BidderId = h.Actor, Shares = 1, BidPricePerShare = 20 });
            db.SaveChanges();
        });
        await Expire(h); await Expire(h);
        Reconcile(h);
        h.WithDb(db => {
            Assert.Equal(12, db.Investments.Where(x => x.PropertyId == h.PropertyId).Sum(x => x.Shares));
            Assert.Equal(1, db.Investments.Where(x => x.PropertyId == h.PropertyId && x.UserId == h.Other).Sum(x => x.Shares));
            Assert.Equal(10, db.Investments.Where(x => x.PropertyId == h.PropertyId && x.UserId == h.Other).Sum(x => x.InvestedAmount));
            Assert.Equal(3000, db.Users.Where(x => x.Id == h.Actor || x.Id == h.Other || x.Id == h.Admin).Sum(x => x.WalletBalance));
            Assert.Single(db.ShareTransactions.Where(x => x.PropertyId == h.PropertyId));
            Assert.NotEmpty(db.UserTransactions.Where(x => x.PropertyId == h.PropertyId));
        });
    }

    [Local262BFact]
    public async Task Full_expiry_splits_referral_fee_and_reconciles_each_wallet()
    {
        using var h = Host();
        h.WithDb(db => {
            db.ShareOffers.Find(h.Offer)!.ExpirationDate = DateTime.UtcNow.AddMinutes(-1);
            db.Referrals.Add(new Referral { Id = Guid.NewGuid(), RefereeUserId = h.Other, InviterUserId = h.Actor,
                ReferrerRewardPercent = .05m, RewardValidUntil = DateTime.UtcNow.AddYears(1) });
            db.ShareOfferBids.Add(new ShareOfferBid { OfferId = h.Offer, BidderId = h.Actor, Shares = 2, BidPricePerShare = 20 }); db.SaveChanges();
        });
        await Expire(h); await Expire(h); Reconcile(h);
        h.WithDb(db => {
            Assert.Equal(1038.60m, db.Users.Find(h.Other)!.WalletBalance);
            Assert.Equal(960.07m, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(1001.33m, db.Users.Find(h.Admin)!.WalletBalance);
            Assert.Equal(0, db.ShareOffers.Find(h.Offer)!.LockedInvestedAmount);
            Assert.Equal(40, db.ShareTransactions.Where(x => x.PropertyId == h.PropertyId).Sum(x => x.Shares * x.PricePerShare));
        });
    }

    [Local262BFact]
    public async Task Invalid_and_unfunded_bids_do_not_block_fundable_bid()
    {
        using var h = Host();
        h.WithDb(db => {
            db.ShareOffers.Find(h.Offer)!.ExpirationDate = DateTime.UtcNow.AddMinutes(-1);
            db.ShareOfferBids.AddRange(
                new ShareOfferBid { OfferId = h.Offer, BidderId = h.Admin, Shares = 2, BidPricePerShare = 1000 },
                new ShareOfferBid { OfferId = h.Offer, BidderId = h.Other, Shares = 2, BidPricePerShare = 100 },
                new ShareOfferBid { OfferId = h.Offer, BidderId = h.Actor, Shares = -1, BidPricePerShare = 100 },
                new ShareOfferBid { OfferId = h.Offer, BidderId = h.Actor, Shares = 2, BidPricePerShare = 10 }); db.SaveChanges();
        });
        await Expire(h); Reconcile(h);
        h.WithDb(db => {
            Assert.Equal(980, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(1020, db.Users.Find(h.Other)!.WalletBalance);
            Assert.DoesNotContain(db.UserTransactions.Where(x => x.PropertyId == h.PropertyId), x => x.Type == TransactionType.ShareMarketFee);
        });
    }

    [Local262BFact]
    public async Task Cancel_fee_has_two_history_legs_and_replay_is_inert()
    {
        using var h = Host(); h.Login(h.Other);
        var first = await h.Client.PostAsJsonAsync($"/api/share-offers/{h.Offer}/cancel", new { pinOrPassword = "2222" });
        Assert.True(first.IsSuccessStatusCode, await first.Content.ReadAsStringAsync());
        Assert.False((await h.Client.PostAsJsonAsync($"/api/share-offers/{h.Offer}/cancel", new { pinOrPassword = "2222" })).IsSuccessStatusCode);
        Reconcile(h);
        h.WithDb(db => { Assert.Single(db.UserTransactions.Where(x => x.UserId == h.Other && x.Type == TransactionType.CancelListingFee)); });
    }

    [Local262BFact]
    public async Task Rejected_application_refund_explains_wallet_once()
    {
        using var h = Host(); h.Login(h.Actor);
        var response = await h.Client.PostAsJsonAsync("/api/investments/apply", new { propertyId = h.PropertyId, requestedShares = 2, stepNumber = 1, pinOrPassword = "1111" });
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        h.WithDb(db => { db.PaymentPlans.Single(x => x.PropertyId == h.PropertyId).DueDate = DateTime.UtcNow.AddMinutes(-1); db.SaveChanges(); });
        await Process(h, "ProcessApplicationRound", h.PropertyId);
        await Process(h, "ProcessApplicationRound", h.PropertyId); Reconcile(h);
        h.WithDb(db => {
            Assert.Equal(1000, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(80, db.Properties.Find(h.PropertyId)!.AvailableShares);
            Assert.Single(db.UserTransactions.Where(x => x.UserId == h.Actor && x.Type == TransactionType.InvestmentRefund));
        });
    }

    [Local262BFact]
    public async Task Expiry_commit_failure_rolls_back_all_writes_then_fresh_run_succeeds()
    {
        var fault = new CommitFault(); using var h = Host(fault);
        h.WithDb(db => {
            db.ShareOffers.Find(h.Offer)!.ExpirationDate = DateTime.UtcNow.AddMinutes(-1);
            db.ShareOfferBids.Add(new ShareOfferBid { OfferId = h.Offer, BidderId = h.Actor, Shares = 1, BidPricePerShare = 20 }); db.SaveChanges();
        });
        fault.Enabled = true; await Expire(h);
        h.WithDb(db => {
            Assert.True(db.ShareOffers.Find(h.Offer)!.IsActive);
            Assert.Equal(1000, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Empty(db.ShareTransactions.Where(x => x.PropertyId == h.PropertyId));
            Assert.Empty(db.UserTransactions.Where(x => x.PropertyId == h.PropertyId));
            Assert.Empty(db.Messages.Where(x => x.RecipientId == h.Other));
            Assert.Equal(10, db.Investments.Where(x => x.PropertyId == h.PropertyId).Sum(x => x.Shares));
        });
        Assert.Equal(1, fault.Calls); fault.Enabled = false; await Expire(h); Reconcile(h);
    }

    [Local262BFact]
    public async Task Concurrent_expiry_reads_conflict_without_double_settlement()
    {
        var gate = new OfferGate(); using var h = Host(gate);
        h.WithDb(db => {
            db.ShareOffers.Find(h.Offer)!.ExpirationDate = DateTime.UtcNow.AddMinutes(-1);
            db.ShareOfferBids.Add(new ShareOfferBid { OfferId = h.Offer, BidderId = h.Actor, Shares = 1, BidPricePerShare = 20 }); db.SaveChanges();
        });
        gate.Enabled = true;
        var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(async _ => {
            try { await Process(h, "ProcessExpiredOffer", h.Offer); return "ok"; }
            catch (Exception ex) when (Conflict(ex)) { return "conflict"; }
        }));
        Assert.Equal(2, gate.Reads); Assert.Contains("conflict", results);
        await Process(h, "ProcessExpiredOffer", h.Offer); Reconcile(h);
        h.WithDb(db => { Assert.Single(db.ShareTransactions.Where(x => x.PropertyId == h.PropertyId)); Assert.Equal(12, db.Investments.Where(x => x.PropertyId == h.PropertyId).Sum(x => x.Shares)); });
    }

    [Local262BFact]
    public async Task Expiry_racing_cancel_returns_each_share_once()
    {
        var gate = new OfferGate(); using var h = Host(gate); h.Login(h.Other);
        h.WithDb(db => { db.ShareOffers.Find(h.Offer)!.ExpirationDate = DateTime.UtcNow.AddMinutes(-1); db.SaveChanges(); });
        gate.Enabled = true;
        var expire = Task.Run(async () => { try { await Process(h, "ProcessExpiredOffer", h.Offer); } catch (Exception ex) when (Conflict(ex)) { } });
        var cancel = h.Client.PostAsJsonAsync($"/api/share-offers/{h.Offer}/cancel", new { pinOrPassword = "2222" });
        await Task.WhenAll(expire, cancel); Assert.Equal(2, gate.Reads);
        Assert.Contains((await cancel).StatusCode, new[] { System.Net.HttpStatusCode.OK, System.Net.HttpStatusCode.Conflict });
        await Process(h, "ProcessExpiredOffer", h.Offer); Reconcile(h);
        h.WithDb(db => {
            Assert.Equal(2, db.Investments.Where(x => x.UserId == h.Other && x.PropertyId == h.PropertyId).Sum(x => x.Shares));
            Assert.Equal(20, db.Investments.Where(x => x.UserId == h.Other && x.PropertyId == h.PropertyId).Sum(x => x.InvestedAmount));
            Assert.False(db.ShareOffers.Find(h.Offer)!.IsActive);
        });
    }

    [Local262BFact]
    public async Task Demo_monthly_restarts_and_concurrency_credit_fixture_only_once()
    {
        using var h = Host();
        h.WithDb(db => { db.Properties.Find(h.PropertyId)!.MonthlyRentalIncome = 100; db.SaveChanges(); });
        var month = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        async Task Run() {
            using var scope = h.Services.CreateScope();
            var svc = new DemoMonthlyProcessor(scope.ServiceProvider.GetRequiredService<RealEstateInvestment.Data.AppDbContext>(), NullLogger<DemoMonthlyProcessor>.Instance);
            try {
                await (Task)typeof(DemoMonthlyProcessor).GetMethod("ProcessUserAsync", BindingFlags.NonPublic | BindingFlags.Instance)!
                    .Invoke(svc, new object[] { h.Demo, month, CancellationToken.None })!;
            } catch (Exception ex) when (Conflict(ex) || ex is DbUpdateException) { }
        }
        await Task.WhenAll(Run(), Run()); await Run(); await Run();
        h.WithDb(db => {
            Assert.Equal(1010, db.DemoUsers.Find(h.Demo)!.WalletBalance);
            Assert.Single(db.DemoRentalIncomes.Where(x => x.DemoInvestorId == h.Demo && x.PropertyId == h.PropertyId));
            Assert.Single(db.DemoUserTransactions.Where(x => x.DemoUserId == h.Demo));
            Assert.Single(db.DemoMonthlyReports.Where(x => x.DemoUserId == h.Demo));
            Assert.Equal(1000, db.Users.Find(h.Actor)!.WalletBalance);
        });
    }

    [Local262BFact]
    public async Task No_fundable_bid_returns_all_ownership_without_wallet_changes()
    {
        using var h = Host();
        h.WithDb(db => {
            db.ShareOffers.Find(h.Offer)!.ExpirationDate = DateTime.UtcNow.AddMinutes(-1);
            db.ShareOfferBids.Add(new ShareOfferBid { OfferId = h.Offer, BidderId = h.Actor, Shares = 2, BidPricePerShare = 1000 }); db.SaveChanges();
        });
        await Expire(h); await Expire(h); Reconcile(h);
        h.WithDb(db => {
            Assert.Equal(2, db.Investments.Where(x => x.UserId == h.Other && x.PropertyId == h.PropertyId).Sum(x => x.Shares));
            Assert.Empty(db.ShareTransactions.Where(x => x.PropertyId == h.PropertyId));
        });
    }

    [Local262BFact]
    public async Task Two_expired_lots_cannot_spend_same_wallet_twice()
    {
        var gate = new OfferGate(); using var h = Host(gate); var second = Guid.NewGuid();
        h.WithDb(db => {
            db.Users.Find(h.Actor)!.WalletBalance = 30;
            db.ShareOffers.Find(h.Offer)!.ExpirationDate = DateTime.UtcNow.AddMinutes(-1);
            db.ShareOffers.Add(new ShareOffer { Id = second, SellerId = h.Other, PropertyId = h.PropertyId,
                SharesForSale = 2, LockedInvestedAmount = 20, StartPricePerShare = 10, ExpirationDate = DateTime.UtcNow.AddMinutes(-1) });
            foreach (var id in new[] { h.Offer, second })
                db.ShareOfferBids.Add(new ShareOfferBid { OfferId = id, BidderId = h.Actor, Shares = 2, BidPricePerShare = 10 });
            db.SaveChanges();
        });
        gate.Enabled = true;
        var results = await Task.WhenAll(new[] { h.Offer, second }.Select(async id => {
            try { await Process(h, "ProcessExpiredOffer", id); return "ok"; }
            catch (Exception ex) when (Conflict(ex)) { return "conflict"; }
        }));
        Assert.Contains("conflict", results); Assert.Equal(2, gate.Reads);
        await Process(h, "ProcessExpiredOffer", h.Offer); await Process(h, "ProcessExpiredOffer", second); Reconcile(h, 30);
        h.WithDb(db => {
            Assert.Equal(10, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Single(db.ShareTransactions.Where(x => x.PropertyId == h.PropertyId));
            Assert.Equal(14, db.Investments.Where(x => x.PropertyId == h.PropertyId).Sum(x => x.Shares));
        });
    }

    [Local262BFact]
    public async Task Concurrent_manual_buys_use_shared_settlement_once()
    {
        var gate = new OfferGate(); using var h = Host(gate); h.Login(h.Actor); gate.Enabled = true;
        var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => h.Client.PostAsJsonAsync(
            $"/api/share-offers/{h.Offer}/buy", new { sharesToBuy = 2, pinOrPassword = "1111" })));
        Assert.Equal(2, gate.Reads); Assert.Equal(1, results.Count(x => x.IsSuccessStatusCode)); Reconcile(h);
        Assert.Contains(results, x => x.StatusCode == System.Net.HttpStatusCode.Conflict);
        h.WithDb(db => { Assert.Single(db.ShareTransactions.Where(x => x.PropertyId == h.PropertyId)); Assert.Equal(0, db.ShareOffers.Find(h.Offer)!.LockedInvestedAmount); });
    }

    [Local262BFact]
    public async Task Rejection_commit_failure_rolls_back_refund_and_capacity_then_retries_once()
    {
        var fault = new CommitFault(); using var h = Host(fault); h.Login(h.Actor);
        Assert.True((await h.Client.PostAsJsonAsync("/api/investments/apply", new { propertyId = h.PropertyId, requestedShares = 2, stepNumber = 1, pinOrPassword = "1111" })).IsSuccessStatusCode);
        h.WithDb(db => { db.PaymentPlans.Single(x => x.PropertyId == h.PropertyId).DueDate = DateTime.UtcNow.AddMinutes(-1); db.SaveChanges(); });
        fault.Enabled = true;
        await Assert.ThrowsAsync<Npgsql.PostgresException>(() => Process(h, "ProcessApplicationRound", h.PropertyId));
        h.WithDb(db => {
            Assert.Equal(980, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(78, db.Properties.Find(h.PropertyId)!.AvailableShares);
            Assert.Equal("pending", db.InvestmentApplications.Single(x => x.UserId == h.Actor).Status);
            Assert.Empty(db.UserTransactions.Where(x => x.UserId == h.Actor && x.Type == TransactionType.InvestmentRefund));
        });
        fault.Enabled = false; await Process(h, "ProcessApplicationRound", h.PropertyId); await Process(h, "ProcessApplicationRound", h.PropertyId); Reconcile(h);
    }

    [Local262BFact]
    public async Task Monthly_and_audit_repeat_email_attempts_have_no_durable_guard()
    {
        using var h = Host();
        var auditRecipient = $"audit-{Guid.NewGuid()}@example.invalid";
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Email:Admin"] = auditRecipient }).Build();
        var period = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        h.WithDb(db => { db.ActionLogs.Add(new ActionLog { UserId = h.Actor, Action = "QA audit fixture", Details = "Isolated fixture", Timestamp = DateTime.UtcNow }); db.SaveChanges(); });
        for (var run = 0; run < 2; run++) {
            using var scope = h.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<RealEstateInvestment.Data.AppDbContext>();
            // No SMTP host and no Resend client: external delivery cannot occur.
            var email = new EmailService(cfg, db, NullLogger<EmailService>.Instance, null!);
            await new MonthlyReportService(db, email, NullLogger<MonthlyReportService>.Instance)
                .GenerateAndSendMonthlyReportAsync(h.Actor, period);
            await new AdminAuditReportService(db, email, cfg, NullLogger<AdminAuditReportService>.Instance)
                .GenerateAndSendAdminAuditAsync(period, period.AddMonths(1));
        }
        h.WithDb(db => {
            var address = db.Users.Find(h.Actor)!.Email;
            Assert.Equal(2, db.ActionLogs.Count(x => x.Action == "EmailError" && x.Details.Contains(address)));
            Assert.Equal(2, db.ActionLogs.Count(x => x.Action == "EmailError" && x.Details.Contains(auditRecipient)));
        });
    }

    [Local262BFact]
    public async Task Missing_treasury_rolls_back_trade_and_preserves_offer_for_review()
    {
        using var h = Host();
        h.WithDb(db => {
            db.Users.Remove(db.Users.Find(h.Admin)!);
            db.ShareOffers.Find(h.Offer)!.ExpirationDate = DateTime.UtcNow.AddMinutes(-1);
            db.ShareOfferBids.Add(new ShareOfferBid { OfferId = h.Offer, BidderId = h.Actor, Shares = 2, BidPricePerShare = 20 }); db.SaveChanges();
        });
        await Expire(h);
        h.WithDb(db => {
            Assert.Equal(1000, db.Users.Find(h.Actor)!.WalletBalance); Assert.Equal(1000, db.Users.Find(h.Other)!.WalletBalance);
            var offer = db.ShareOffers.Find(h.Offer)!; Assert.True(offer.IsActive); Assert.Equal(2, offer.SharesForSale); Assert.Equal(20, offer.LockedInvestedAmount);
            Assert.Empty(db.UserTransactions.Where(x => x.PropertyId == h.PropertyId));
            Assert.Empty(db.ShareTransactions.Where(x => x.PropertyId == h.PropertyId));
        });
    }

    [Local262BFact]
    public async Task Cancel_commit_failure_rolls_back_fee_history_and_ownership_together()
    {
        var fault = new CommitFault(); using var h = Host(fault); h.Login(h.Other); fault.Enabled = true;
        var result = await h.Client.PostAsJsonAsync($"/api/share-offers/{h.Offer}/cancel", new { pinOrPassword = "2222" });
        Assert.Equal(System.Net.HttpStatusCode.Conflict, result.StatusCode);
        h.WithDb(db => {
            Assert.True(db.ShareOffers.Find(h.Offer)!.IsActive);
            Assert.Equal(1000, db.Users.Find(h.Other)!.WalletBalance);
            Assert.Equal(1000, db.Users.Find(h.Admin)!.WalletBalance);
            Assert.Empty(db.Investments.Where(x => x.UserId == h.Other && x.PropertyId == h.PropertyId));
            Assert.Empty(db.UserTransactions.Where(x => x.PropertyId == h.PropertyId));
        });
        fault.Enabled = false;
        Assert.True((await h.Client.PostAsJsonAsync($"/api/share-offers/{h.Offer}/cancel", new { pinOrPassword = "2222" })).IsSuccessStatusCode);
        Reconcile(h);
    }

    private static bool Conflict(Exception ex) => ex is Npgsql.PostgresException { SqlState: "40001" or "40P01" } || (ex.InnerException != null && Conflict(ex.InnerException));
    private sealed class CommitFault : DbTransactionInterceptor
    {
        public bool Enabled; public int Calls;
        public override ValueTask<InterceptionResult> TransactionCommittingAsync(DbTransaction transaction, TransactionEventData eventData, InterceptionResult result, CancellationToken cancellationToken = default) {
            Assert.Equal(System.Data.IsolationLevel.Serializable, transaction.IsolationLevel);
            if (Enabled) { Calls++; throw new Npgsql.PostgresException("Injected before commit", "ERROR", "ERROR", "40001"); }
            return ValueTask.FromResult(result);
        }
    }
    private sealed class OfferGate : DbCommandInterceptor
    {
        public bool Enabled; public int Reads;
        private readonly TaskCompletionSource release = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData eventData, DbDataReader result, CancellationToken cancellationToken = default) {
            if (Enabled && command.CommandText.Contains("FROM \"ShareOffers\"")) {
                var n = Interlocked.Increment(ref Reads);
                if (n == 2) { Enabled = false; release.TrySetResult(); }
                await release.Task.WaitAsync(TimeSpan.FromSeconds(15), cancellationToken);
            }
            return result;
        }
    }
}

// Integration classes share one retained restore. Their fixture setup must not
// compete with another class's expiry scan. Race tests still run concurrent transactions.
[CollectionDefinition("RestoredPostgres", DisableParallelization = true)]
public sealed class RestoredPostgresCollection { }
