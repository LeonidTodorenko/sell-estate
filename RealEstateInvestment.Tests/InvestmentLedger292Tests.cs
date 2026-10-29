using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using Xunit;

namespace RealEstateInvestment.Tests;

[Collection("Ledger292Postgres")]
public sealed class InvestmentLedger292Tests
{
    private static FinancialTestHost Host(IInterceptor? fault = null) => new(interceptor: fault,
        isolatedPostgres: Environment.GetEnvironmentVariable("QA292_DB") ?? throw new InvalidOperationException("Set QA292_DB to the isolated local fixture database"));
    private static object Request(FinancialTestHost h, int shares = 1) => new { propertyId = h.PropertyId, requestedShares = shares, stepNumber = 1, pinOrPassword = "1111" };
    private static Task<HttpResponseMessage> Apply(FinancialTestHost h, int shares = 1) => h.Client.PostAsJsonAsync("/api/investments/apply", Request(h, shares));
    private static Task<HttpResponseMessage> Refund(FinancialTestHost h) => h.Client.PostAsync($"/api/investments/validate-payments/{h.PropertyId}", null);
    private static Task Round(FinancialTestHost h) => (Task)typeof(ScheduledTaskService).GetMethod("ProcessApplicationRound", BindingFlags.Instance | BindingFlags.NonPublic)!
        .Invoke(new ScheduledTaskService(h.Services, null!), new object[] { h.PropertyId })!;
    private static void Direct(FinancialTestHost h) => h.WithDb(db =>
    {
        db.PaymentPlans.Single(x => x.PropertyId == h.PropertyId).DueDate = DateTime.UtcNow.AddDays(-1);
        db.ShareOffers.RemoveRange(db.ShareOffers.Where(x => x.PropertyId == h.PropertyId));
        db.SaveChanges();
    });
    private static void RefundFixture(FinancialTestHost h)
    {
        Direct(h);
        h.WithDb(db =>
        {
            db.Investments.Single(x => x.PropertyId == h.PropertyId).InvestedAmount = 10;
            db.Investments.Add(new Investment { UserId = h.Other, PropertyId = h.PropertyId, Shares = 5, InvestedAmount = 50 });
            db.SaveChanges();
        });
        h.Login(h.Admin, role: "admin");
    }
    private static void AssertJournals(FinancialTestHost h, TransactionType type, decimal total, int count, Guid actor)
    {
        h.WithDb(db =>
        {
            var entries = db.UserTransactions.Where(t => t.PropertyId == h.PropertyId).ToList();
            Assert.Equal(count, entries.Count); Assert.Equal(total, entries.Sum(t => t.Amount));
            Assert.All(entries, t => { Assert.Equal(type, t.Type); Assert.True(t.Amount > 0); Assert.NotEqual(Guid.Empty, t.Id); Assert.NotNull(t.Shares); });
            var logs = db.ActionLogs.AsEnumerable().Where(l => l.Details.Contains(h.PropertyId.ToString()) && l.Details.StartsWith("{")).ToList();
            Assert.Equal(count, logs.Count);
            foreach (var t in entries)
            {
                var log = Assert.Single(logs, l => JsonDocument.Parse(l.Details).RootElement.GetProperty("transactionId").GetGuid() == t.Id);
                Assert.Equal(actor, log.UserId);
                using var json = JsonDocument.Parse(log.Details); var root = json.RootElement;
                Assert.Equal(t.Amount, root.GetProperty("amount").GetDecimal());
                Assert.Equal(t.UserId, root.GetProperty("affectedUser").GetGuid());
                Assert.Equal(h.PropertyId, root.GetProperty("propertyId").GetGuid());
                Assert.Equal(actor == Guid.Empty ? "scheduler" : actor.ToString(), root.GetProperty("actor").GetString());
                Assert.Equal(type == TransactionType.Investment ? "investment.debit" : "investment.refund.credit", root.GetProperty("eventType").GetString());
                Assert.DoesNotContain("1111", root.GetProperty("operationContext").GetString());
                Assert.DoesNotContain("pinOrPassword", log.Details);
                if (type == TransactionType.Investment) Assert.NotEqual(Guid.Empty, root.GetProperty("sourceId").GetGuid());
            }
        });
    }

    [Local292Theory]
    [InlineData(false)] [InlineData(true)]
    public async Task Investment_records_one_debit_and_replays_same_key(bool direct)
    {
        using var h = Host(); if (direct) Direct(h); h.Login(h.Actor);
        h.Client.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.OK, (await Apply(h)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Apply(h)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Apply(h, 2)).StatusCode);
        h.WithDb(db =>
        {
            Assert.Equal(990, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(79, db.Properties.Find(h.PropertyId)!.AvailableShares);
            Assert.Equal(direct ? 11 : 10, db.Investments.Where(x => x.PropertyId == h.PropertyId).Sum(x => x.Shares));
            Assert.Equal(direct ? 0 : 1, db.InvestmentApplications.Count(x => x.PropertyId == h.PropertyId));
        });
        AssertJournals(h, TransactionType.Investment, 10, 1, h.Actor);
    }

    [Local292Fact]
    public async Task Manual_refund_credits_60_and_repeat_does_nothing()
    {
        using var h = Host(); RefundFixture(h);
        Assert.Equal(HttpStatusCode.OK, (await Refund(h)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Refund(h)).StatusCode);
        h.WithDb(db =>
        {
            Assert.Equal(1010, db.Users.Find(h.Actor)!.WalletBalance); Assert.Equal(1050, db.Users.Find(h.Other)!.WalletBalance);
            Assert.Empty(db.Investments.Where(x => x.PropertyId == h.PropertyId));
            Assert.Equal(95, db.Properties.Find(h.PropertyId)!.AvailableShares);
        });
        AssertJournals(h, TransactionType.InvestmentRefund, 60, 2, h.Admin);
    }

    [Local292Fact]
    public async Task Delete_refunds_once_and_preserves_existing_action_name()
    {
        using var h = Host(); h.Login(h.Admin, role: "admin"); Guid id = default;
        h.WithDb(db => id = db.Investments.Single(x => x.PropertyId == h.PropertyId).Id);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.DeleteAsync($"/api/investments/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.DeleteAsync($"/api/investments/{id}")).StatusCode);
        AssertJournals(h, TransactionType.InvestmentRefund, 100, 1, h.Admin);
    }

    [Local292Theory]
    [InlineData("apply", false)] [InlineData("refund", false)] [InlineData("scheduler", false)]
    [InlineData("apply", true)] [InlineData("refund", true)] [InlineData("scheduler", true)]
    public async Task Failure_after_database_writes_or_at_commit_rolls_back_all_and_retry_succeeds(string path, bool commit)
    {
        var fault = new Failure(); using var h = Host(fault);
        if (path == "refund") RefundFixture(h);
        else if (path == "scheduler") Pending(h);
        else { Direct(h); h.Login(h.Actor); h.Client.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString()); }
        var beforeShares = 0; h.WithDb(db => beforeShares = db.Properties.Find(h.PropertyId)!.AvailableShares);
        fault.Mode = commit ? "commit" : "saved";
        if (path == "scheduler") await Assert.ThrowsAsync<InvalidOperationException>(() => Round(h));
        else await Assert.ThrowsAsync<InvalidOperationException>(async () => { if (path == "refund") await Refund(h); else await Apply(h); });
        h.WithDb(db =>
        {
            Assert.Equal(1000, db.Users.Find(h.Actor)!.WalletBalance); Assert.Equal(1000, db.Users.Find(h.Other)!.WalletBalance);
            Assert.Empty(db.UserTransactions.Where(t => t.PropertyId == h.PropertyId));
            Assert.DoesNotContain(db.ActionLogs.AsEnumerable(), l => l.Details.Contains(h.PropertyId.ToString()));
            Assert.Equal(beforeShares, db.Properties.Find(h.PropertyId)!.AvailableShares);
            if (path == "refund") Assert.Equal(2, db.Investments.Count(x => x.PropertyId == h.PropertyId));
            if (path == "scheduler") Assert.All(db.InvestmentApplications.Where(x => x.PropertyId == h.PropertyId), x => Assert.Equal("pending", x.Status));
        });
        fault.Mode = "";
        if (path == "scheduler") { await Round(h); await Round(h); }
        else Assert.Equal(HttpStatusCode.OK, (await (path == "refund" ? Refund(h) : Apply(h))).StatusCode);
        AssertJournals(h, path == "apply" ? TransactionType.Investment : TransactionType.InvestmentRefund,
            path == "apply" ? 10 : 60, path == "apply" ? 1 : 2, path == "scheduler" ? Guid.Empty : path == "apply" ? h.Actor : h.Admin);
    }

    private static void Pending(FinancialTestHost h)
    {
        Direct(h); h.WithDb(db =>
        {
            db.Investments.RemoveRange(db.Investments.Where(x => x.PropertyId == h.PropertyId));
            foreach (var user in new[] { h.Actor, h.Other }) db.InvestmentApplications.Add(new InvestmentApplication
                { UserId = user, PropertyId = h.PropertyId, RequestedAmount = 30, RequestedShares = 3 });
            db.SaveChanges();
        });
    }
    [Local292Fact]
    public async Task Scheduler_refund_and_manual_call_cannot_double_refund_reservations()
    {
        using var h = Host(); Pending(h); h.Login(h.Admin, role: "admin");
        Assert.Equal(HttpStatusCode.Conflict, (await Refund(h)).StatusCode);
        await Round(h); await Round(h);
        Assert.Equal(HttpStatusCode.OK, (await Refund(h)).StatusCode);
        AssertJournals(h, TransactionType.InvestmentRefund, 60, 2, Guid.Empty);
        h.WithDb(db => Assert.All(db.InvestmentApplications.Where(x => x.PropertyId == h.PropertyId), x => Assert.Equal("rejected", x.Status)));
    }

    [Local292Fact]
    public async Task Scheduler_acceptance_does_not_debit_reserved_wallet_again()
    {
        using var h = Host(); Pending(h);
        h.WithDb(db => { db.PaymentPlans.Single(x => x.PropertyId == h.PropertyId).Total = 60; db.SaveChanges(); });
        await Round(h); await Round(h);
        h.WithDb(db =>
        {
            Assert.Equal(1000, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(60, db.Investments.Where(x => x.PropertyId == h.PropertyId).Sum(x => x.InvestedAmount));
            Assert.Empty(db.UserTransactions.Where(x => x.PropertyId == h.PropertyId));
        });
    }

    [Local292Theory]
    [InlineData(true)] [InlineData(false)]
    public async Task Concurrent_debits_enforce_key_or_wallet_capacity(bool sameKey)
    {
        var gate = new SaveGate(); using var h = Host(gate); Direct(h); h.Login(h.Actor);
        if (sameKey) h.Client.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
        gate.Enabled = true;
        var results = await Task.WhenAll(Apply(h, sameKey ? 1 : 70), Apply(h, sameKey ? 1 : 70));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.Conflict);
        AssertJournals(h, TransactionType.Investment, sameKey ? 10 : 700, 1, h.Actor);
        h.WithDb(db => Assert.Equal(sameKey ? 990 : 300, db.Users.Find(h.Actor)!.WalletBalance));
        if (sameKey) Assert.Equal(HttpStatusCode.OK, (await Apply(h)).StatusCode);
    }

    [Local292Fact]
    public async Task Concurrent_refunds_credit_each_holding_once()
    {
        var gate = new SaveGate(); using var h = Host(gate); RefundFixture(h); gate.Enabled = true;
        var results = await Task.WhenAll(Refund(h), Refund(h));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(HttpStatusCode.OK, (await Refund(h)).StatusCode);
        AssertJournals(h, TransactionType.InvestmentRefund, 60, 2, h.Admin);
    }

    [Local292Fact]
    public async Task Invalid_second_holding_aborts_partially_staged_refund()
    {
        using var h = Host(); RefundFixture(h);
        h.WithDb(db => { db.Investments.Single(x => x.PropertyId == h.PropertyId && x.UserId == h.Other).InvestedAmount = -50; db.SaveChanges(); });
        await Assert.ThrowsAsync<InvalidOperationException>(() => Refund(h));
        h.WithDb(db =>
        {
            Assert.Equal(1000, db.Users.Find(h.Actor)!.WalletBalance); Assert.Equal(1000, db.Users.Find(h.Other)!.WalletBalance);
            Assert.Equal(2, db.Investments.Count(x => x.PropertyId == h.PropertyId));
            Assert.Empty(db.UserTransactions.Where(x => x.PropertyId == h.PropertyId));
            Assert.DoesNotContain(db.ActionLogs.AsEnumerable(), l => l.Details.Contains(h.PropertyId.ToString()));
        });
    }

    [Local292Fact]
    public async Task Validation_failures_and_active_offers_create_no_journals()
    {
        using var h = Host(); h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.BadRequest, (await Apply(h, 0)).StatusCode);
        h.Client.DefaultRequestHeaders.Add("Idempotency-Key", "invalid");
        Assert.Equal(HttpStatusCode.BadRequest, (await Apply(h)).StatusCode);
        h.Client.DefaultRequestHeaders.Remove("Idempotency-Key");
        h.Login(h.Admin, role: "admin");
        h.WithDb(db => { db.PaymentPlans.Single(x => x.PropertyId == h.PropertyId).DueDate = DateTime.UtcNow.AddDays(-1); db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.Conflict, (await Refund(h)).StatusCode);
        h.WithDb(db => { Assert.Empty(db.UserTransactions.Where(x => x.PropertyId == h.PropertyId)); Assert.Equal(1000, db.Users.Find(h.Actor)!.WalletBalance); });
    }

    [Local292Fact]
    public async Task Concurrent_scheduler_rounds_refund_once_and_fresh_retry_is_safe()
    {
        var gate = new SaveGate(); using var h = Host(gate); Pending(h); gate.Enabled = true;
        async Task<bool> Attempt()
        {
            try { await Round(h); return true; }
            catch (Exception ex) when (IsConflict(ex)) { return false; }
        }
        var results = await Task.WhenAll(Attempt(), Attempt());
        Assert.Single(results, x => x); Assert.Single(results, x => !x);
        await Round(h);
        AssertJournals(h, TransactionType.InvestmentRefund, 60, 2, Guid.Empty);
        h.WithDb(db => { Assert.Equal(1030, db.Users.Find(h.Actor)!.WalletBalance); Assert.Equal(1030, db.Users.Find(h.Other)!.WalletBalance); });
    }
    private static bool IsConflict(Exception? ex) => ex != null &&
        (ex is DbUpdateConcurrencyException || ex is Npgsql.PostgresException { SqlState: "40001" or "40P01" } || IsConflict(ex.InnerException));

    [Local292Theory]
    [InlineData("sold")] [InlineData("rented")]
    public async Task Finalized_property_rejects_new_investment_and_refund(string status)
    {
        using var h = Host(); RefundFixture(h);
        h.WithDb(db => { db.Properties.Find(h.PropertyId)!.Status = status; db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.Conflict, (await Refund(h)).StatusCode);
        h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.Conflict, (await Apply(h)).StatusCode);
        h.WithDb(db => Assert.Empty(db.UserTransactions.Where(x => x.PropertyId == h.PropertyId)));
    }

    private sealed class SaveGate : SaveChangesInterceptor
    {
        public bool Enabled; private int calls;
        private readonly TaskCompletionSource gate = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData data, InterceptionResult<int> result, CancellationToken token = default)
        {
            if (Enabled && Interlocked.Increment(ref calls) <= 2)
            {
                if (calls == 2) gate.TrySetResult();
                await gate.Task.WaitAsync(TimeSpan.FromSeconds(15));
            }
            return result;
        }
    }
    private sealed class Failure : DbTransactionInterceptor, ISaveChangesInterceptor
    {
        public string Mode = "";
        public ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData data, int result, CancellationToken token = default)
        {
            if (Mode == "saved") throw new InvalidOperationException("Injected failure after writes");
            return ValueTask.FromResult(result);
        }
        public override ValueTask<InterceptionResult> TransactionCommittingAsync(DbTransaction transaction, TransactionEventData data, InterceptionResult result, CancellationToken token = default)
        {
            if (Mode == "commit") throw new InvalidOperationException("Injected failure at commit");
            return ValueTask.FromResult(result);
        }
    }
}
public sealed class Local292FactAttribute : FactAttribute
{
    public Local292FactAttribute() { if (Environment.GetEnvironmentVariable("QA292_DB") == null) Skip = "Requires dedicated local PostgreSQL fixture"; }
}
public sealed class Local292TheoryAttribute : TheoryAttribute
{
    public Local292TheoryAttribute() { if (Environment.GetEnvironmentVariable("QA292_DB") == null) Skip = "Requires dedicated local PostgreSQL fixture"; }
}
