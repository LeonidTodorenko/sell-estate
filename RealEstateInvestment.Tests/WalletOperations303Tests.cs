using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using Xunit;

namespace RealEstateInvestment.Tests;

[Collection("Ledger292Postgres")]
public sealed class WalletOperations303Tests
{
    private static FinancialTestHost Host(bool postgres = false, IInterceptor? interceptor = null) =>
        new(services =>
        {
            services.AddSingleton(Options.Create(new PaymentOptions
            {
                Enabled = true, ShopId = "1514010", SecretKey = "test_fixture",
                ReturnUrl = "https://example.invalid/top-up", ChargeUnitsPerWalletUnit = 80
            }));
            services.AddSingleton<IYooKassaPayments, ForbiddenGateway>();
            services.AddScoped<PaymentService>();
        }, interceptor, postgres ? Environment.GetEnvironmentVariable("QA292_DB")! : null);

    private static async Task<Guid> Id(Task<HttpResponseMessage> pending)
    {
        using var response = await pending;
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    private static Task<HttpResponseMessage> Bank(FinancialTestHost h) =>
        h.Client.PostAsJsonAsync("/api/payments", new { requestKey = Guid.NewGuid(), amount = 200m, method = "bank_transfer" });

    private static Task<HttpResponseMessage> Review(FinancialTestHost h, Guid id, string action, string? reason = null) =>
        h.Client.PostAsJsonAsync($"/api/payments/admin/{id}/review", new { action, reason });

    private static Task<HttpResponseMessage> Withdraw(FinancialTestHost h, Guid key, decimal amount = 40m) =>
        h.Client.PostAsJsonAsync("/api/withdrawals/request", new { requestKey = key, amount, testDestination = "TEST-BANK-001" });

    private static Task<HttpResponseMessage> Resolve(FinancialTestHost h, Guid id, string action, string? reason = null) =>
        h.Client.PostAsJsonAsync($"/api/withdrawals/{id}/{action}", new { reason });

    [Fact]
    public async Task Test_bank_rejection_records_reason_and_never_credits()
    {
        using var h = Host();
        h.Login(h.Actor);
        var id = await Id(Bank(h));
        Assert.Equal(HttpStatusCode.Forbidden, (await Review(h, id, "confirm")).StatusCode);
        h.Login(h.Admin, role: "admin");
        Assert.Equal(HttpStatusCode.BadRequest, (await Review(h, id, "reject")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Review(h, id, "reject", "TEST declined")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Review(h, id, "confirm")).StatusCode);
        h.WithDb(db =>
        {
            var payment = db.Payments.Find(id)!;
            Assert.Equal("rejected", payment.Status);
            Assert.Equal("TEST declined", payment.RejectionReason);
            Assert.Null(payment.CreditedAt);
            Assert.Equal(1000m, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Empty(db.UserTransactions);
            Assert.Contains("TEST declined", db.ActionLogs.Single().Details);
        });
    }

    [Fact]
    public async Task Keyed_withdrawal_recovers_and_only_owner_can_cancel_once()
    {
        using var h = Host();
        h.Login(h.Actor);
        var key = Guid.NewGuid();
        var id = await Id(Withdraw(h, key));
        Assert.Equal(id, await Id(Withdraw(h, key)));
        Assert.Equal(HttpStatusCode.Conflict, (await Withdraw(h, key, 41m)).StatusCode);
        h.Login(h.Other);
        Assert.Equal(HttpStatusCode.NotFound, (await Resolve(h, id, "cancel")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Resolve(h, id, "approve")).StatusCode);
        h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.OK, (await Resolve(h, id, "cancel")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Resolve(h, id, "cancel")).StatusCode);
        h.WithDb(db =>
        {
            Assert.Equal(1000m, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal("canceled", db.WithdrawalRequests.Find(id)!.Status);
            Assert.Single(db.UserTransactions.Where(x => x.UserId == h.Actor && x.Type == TransactionType.Withdrawal));
            Assert.Single(db.UserTransactions.Where(x => x.UserId == h.Actor && x.Type == TransactionType.WithdrawalRefund));
        });
    }

    [Local292Fact]
    public async Task Concurrent_test_bank_approvals_credit_and_audit_once_on_PostgreSQL()
    {
        var gate = new ReviewGate("SandboxPayments");
        using var h = Host(true, gate);
        h.Login(h.Actor);
        var id = await Id(Bank(h));
        h.WithDb(db =>
        {
            Assert.Equal("requested", db.Payments.Find(id)!.Status);
            Assert.Equal(1000m, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Empty(db.UserTransactions.Where(x => x.UserId == h.Actor));
        });
        h.Login(h.Admin, role: "admin");
        gate.Enabled = true;
        var results = await Task.WhenAll(Review(h, id, "confirm"), Review(h, id, "confirm"));
        Assert.All(results, x => Assert.Equal(HttpStatusCode.OK, x.StatusCode));
        h.WithDb(db =>
        {
            var payment = db.Payments.Find(id)!;
            Assert.Equal("succeeded", payment.Status);
            Assert.NotNull(payment.CreditedAt);
            Assert.Equal(1002.50m, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(payment.WalletAmount, db.UserTransactions.Single(x => x.Id == id).Amount);
            Assert.Contains("manualSimulation", db.ActionLogs.Single(x => x.Id == id).Details);
        });
    }

    [Local292Fact]
    public async Task Test_bank_audit_failure_rolls_back_on_PostgreSQL()
    {
        using var h = Host(true);
        h.Login(h.Actor);
        var id = await Id(Bank(h));
        h.WithDb(db =>
        {
            db.ActionLogs.Add(new ActionLog { Id = id, UserId = h.Actor, Action = "Fixture", Details = "Duplicate audit ID" });
            db.SaveChanges();
        });
        h.Login(h.Admin, role: "admin");
        Assert.Equal(HttpStatusCode.Conflict, (await Review(h, id, "confirm")).StatusCode);
        h.WithDb(db =>
        {
            Assert.Equal("requested", db.Payments.Find(id)!.Status);
            Assert.Null(db.Payments.Find(id)!.CreditedAt);
            Assert.Equal(1000m, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Null(db.UserTransactions.Find(id));
        });
    }

    [Local292Theory]
    [InlineData("reject", "reject")]
    [InlineData("approve", "reject")]
    public async Task Concurrent_withdrawal_decisions_have_one_terminal_effect_on_PostgreSQL(string first, string second)
    {
        var gate = new ReviewGate("WithdrawalRequests");
        using var h = Host(true, gate);
        h.Login(h.Actor);
        var id = await Id(Withdraw(h, Guid.NewGuid()));
        h.Login(h.Admin, role: "admin");
        gate.Enabled = true;
        var results = await Task.WhenAll(Resolve(h, id, first, "TEST reason"), Resolve(h, id, second, "TEST reason"));
        Assert.Single(results, x => x.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, x => x.StatusCode == HttpStatusCode.Conflict);
        h.WithDb(db =>
        {
            var request = db.WithdrawalRequests.Find(id)!;
            var rejected = request.Status == "rejected";
            Assert.Contains(request.Status, new[] { "approved", "rejected" });
            if (first == "reject") Assert.True(rejected);
            Assert.Equal(h.Admin, request.ProcessedBy);
            Assert.Equal(rejected ? 1000m : 960m, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Single(db.UserTransactions.Where(x => x.UserId == h.Actor && x.Type == TransactionType.Withdrawal));
            Assert.Equal(rejected ? 1 : 0, db.UserTransactions.Count(x => x.UserId == h.Actor && x.Type == TransactionType.WithdrawalRefund));
            Assert.Single(db.ActionLogs.Where(x => x.UserId == h.Admin));
        });
    }

    [Local292Fact]
    public async Task Concurrent_owner_cancellations_return_the_reserve_once_on_PostgreSQL()
    {
        var gate = new ReviewGate("WithdrawalRequests");
        using var h = Host(true, gate);
        h.Login(h.Actor);
        var id = await Id(Withdraw(h, Guid.NewGuid()));
        gate.Enabled = true;
        var results = await Task.WhenAll(Resolve(h, id, "cancel"), Resolve(h, id, "cancel"));
        Assert.Single(results, x => x.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, x => x.StatusCode == HttpStatusCode.Conflict);
        h.WithDb(db =>
        {
            Assert.Equal("canceled", db.WithdrawalRequests.Find(id)!.Status);
            Assert.Equal(1000m, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Single(db.UserTransactions.Where(x => x.UserId == h.Actor && x.Type == TransactionType.WithdrawalRefund));
            Assert.Single(db.ActionLogs.Where(x => x.UserId == h.Actor && x.Action == "CancelWithdrawal"));
        });
    }

    // Force both review requests past their initial read before either can update.
    private sealed class ReviewGate(string table) : DbCommandInterceptor
    {
        public bool Enabled { get; set; }
        private int arrivals;
        private readonly TaskCompletionSource gate = new(TaskCreationOptions.RunContinuationsAsynchronously);

        private async Task Wait(DbCommand command, CancellationToken ct)
        {
            if (!Enabled || !command.CommandText.Contains($"UPDATE \"{table}\"")) return;
            var arrival = Interlocked.Increment(ref arrivals);
            if (arrival == 2) gate.TrySetResult();
            if (arrival <= 2) await gate.Task.WaitAsync(TimeSpan.FromSeconds(15), ct);
        }

        public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command,
            CommandEventData data, InterceptionResult<int> result, CancellationToken ct = default)
        {
            await Wait(command, ct);
            return result;
        }

        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
            CommandEventData data, InterceptionResult<DbDataReader> result, CancellationToken ct = default)
        {
            await Wait(command, ct);
            return result;
        }
    }

    private sealed class ForbiddenGateway : IYooKassaPayments
    {
        public Task<VerifiedPayment> Create(WalletPayment payment, CancellationToken ct) =>
            throw new InvalidOperationException("Manual tests must never call the payment gateway");

        public Task<VerifiedPayment> Get(string id, CancellationToken ct) =>
            throw new InvalidOperationException("Manual tests must never call the payment gateway");
    }
}
