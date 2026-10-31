using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateInvestment.Controllers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using Xunit;

namespace RealEstateInvestment.Tests;

public sealed class Webhook297Tests
{
    sealed class Capture : ILogger<WalletPaymentsController>
    {
        public readonly List<Dictionary<string, object?>> Rows = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel level) => true;
        public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            Assert.Null(exception);
            Assert.Equal(2970, id.Id);
            Rows.Add(((IEnumerable<KeyValuePair<string, object?>>)(object)state!).ToDictionary(x => x.Key, x => x.Value));
        }
    }
    sealed class Gateway : IYooKassaPayments
    {
        public VerifiedPayment Remote = null!;
        public bool Fail;
        public Task<VerifiedPayment> Create(WalletPayment p, CancellationToken ct)
        {
            Remote = new(Guid.NewGuid().ToString(), "pending", true, false, p.ShopId, p.Amount, p.ChargeCurrency, p.Id, null);
            return Task.FromResult(Remote);
        }
        public Task<VerifiedPayment> Get(string id, CancellationToken ct) => Fail
            ? throw new HttpRequestException("SECRET_EXCEPTION_RAW_BODY") : Task.FromResult(Remote);
    }
    static FinancialTestHost Host(Gateway gateway, Capture log) => new(s =>
    {
        s.AddSingleton<IYooKassaPayments>(gateway);
        s.AddSingleton<ILogger<WalletPaymentsController>>(log);
        s.AddSingleton(Options.Create(new PaymentOptions { Enabled=true, ShopId="1514010", SecretKey="test_fixture", ReturnUrl="https://example.invalid", ChargeUnitsPerWalletUnit=100 }));
        s.AddScoped<PaymentService>();
    });
    static async Task<Guid> Create(FinancialTestHost h)
    {
        h.Login(h.Actor);
        var r=await h.Client.PostAsJsonAsync("/api/payments",new {requestKey=Guid.NewGuid(),amount=100});
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }
    static Task<HttpResponseMessage> Send(FinancialTestHost h, string id, string ev="payment.succeeded") =>
        h.Client.PostAsJsonAsync("/api/payments/webhook",new { @event=ev, @object=new {id,status="succeeded", email="PII_SENTINEL", card="CARD_SENTINEL"}, raw="RAW_SENTINEL" });
    [Theory]
    [InlineData("succeeded", "settlement")]
    [InlineData("canceled", "ignored")]
    [InlineData("pending", "ignored")]
    public async Task Verified_decisions_and_replays_match_committed_effects(string status,string decision)
    {
        var g=new Gateway();var log=new Capture();using var h=Host(g,log);var id=await Create(h);
        g.Remote=g.Remote with {Status=status,Paid=status=="succeeded"};
        h.Client.DefaultRequestHeaders.Add("X-Api-Key","KEY_SENTINEL");
        h.Login(null);
        var before=DateTimeOffset.UtcNow;
        (await Send(h,g.Remote.Id)).EnsureSuccessStatusCode();
        var row=Assert.Single(log.Rows);
        Assert.Equal("verified",row["Verification"]);Assert.Equal(decision,row["Decision"]);
        Assert.Equal(g.Remote.Id,row["ProviderPaymentId"]);Assert.Equal("payment.succeeded",row["WebhookEvent"]);
        Assert.InRange((DateTimeOffset)row["RequestTimestamp"]!,before,DateTimeOffset.UtcNow);
        Assert.Equal(6,row.Count); // five fields plus fixed OriginalFormat
        (await Send(h,g.Remote.Id)).EnsureSuccessStatusCode();
        Assert.Equal(status=="pending"?"ignored":"duplicate",log.Rows[1]["Decision"]);
        var json=JsonSerializer.Serialize(log.Rows);
        foreach(var secret in new[]{"PII_SENTINEL","CARD_SENTINEL","RAW_SENTINEL","KEY_SENTINEL"}) Assert.DoesNotContain(secret,json);
        h.WithDb(db=>{Assert.Equal(status=="succeeded"?1001:1000,db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(status=="succeeded"?1:0,db.UserTransactions.Count(x=>x.Id==id));
            Assert.Equal(status=="succeeded"?1:0,db.ActionLogs.Count(x=>x.Id==id));
            Assert.Equal(status,db.Payments.Find(id)!.Status);});
    }
    [Theory][InlineData(true)][InlineData(false)]
    public async Task Verification_failure_retries_without_logging_exception_or_credit(bool network)
    {
        var g=new Gateway();var log=new Capture();using var h=Host(g,log);await Create(h);
        if(network)g.Fail=true;else g.Remote=g.Remote with {Amount=999};
        Assert.Equal(HttpStatusCode.ServiceUnavailable,(await Send(h,g.Remote.Id)).StatusCode);
        var row=Assert.Single(log.Rows);Assert.Equal("failed",row["Verification"]);Assert.Equal("retry",row["Decision"]);
        Assert.DoesNotContain("SECRET_EXCEPTION",JsonSerializer.Serialize(row));
        h.WithDb(db=>{Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Empty(db.UserTransactions);Assert.Empty(db.ActionLogs);});
    }
    [Fact]
    public async Task Settlement_rollback_logs_verified_retry_and_keeps_balance()
    {
        var g=new Gateway();var log=new Capture();using var h=Host(g,log);var id=await Create(h);
        h.WithDb(db=>{db.UserTransactions.Add(new(){Id=id,UserId=h.Actor,Amount=1,
            Type=RealEstateInvestment.Enums.TransactionType.Deposit,Timestamp=DateTime.UtcNow});db.SaveChanges();});
        g.Remote=g.Remote with {Status="succeeded",Paid=true};
        Assert.Equal(HttpStatusCode.ServiceUnavailable,(await Send(h,g.Remote.Id)).StatusCode);
        var row=Assert.Single(log.Rows);Assert.Equal("verified",row["Verification"]);Assert.Equal("retry",row["Decision"]);
        h.WithDb(db=>{Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Null(db.Payments.Find(id)!.CreditedAt);Assert.Empty(db.ActionLogs);});
    }
    [Fact]
    public async Task Canceled_notification_uses_provider_state_and_records_no_settlement()
    {
        var g=new Gateway();var log=new Capture();using var h=Host(g,log);var id=await Create(h);
        (await Send(h,g.Remote.Id,"payment.canceled")).EnsureSuccessStatusCode();
        Assert.Equal("ignored",log.Rows[0]["Decision"]);
        h.WithDb(db=>Assert.Equal("pending",db.Payments.Find(id)!.Status));
        g.Remote=g.Remote with {Status="canceled"};
        (await Send(h,g.Remote.Id,"payment.canceled")).EnsureSuccessStatusCode();
        (await Send(h,g.Remote.Id,"payment.canceled")).EnsureSuccessStatusCode();
        Assert.Equal("verified",log.Rows[1]["Verification"]);Assert.Equal("ignored",log.Rows[1]["Decision"]);
        Assert.Equal("duplicate",log.Rows[2]["Decision"]);
        h.WithDb(db=>{Assert.Equal("canceled",db.Payments.Find(id)!.Status);Assert.Null(db.Payments.Find(id)!.CreditedAt);
            Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Empty(db.UserTransactions);Assert.Empty(db.ActionLogs);});
    }
    [Theory][InlineData("payment.succeeded")][InlineData("PII_EVENT\r\nFORGED")]
    public async Task Untrusted_fields_are_not_written_to_log(string ev)
    {
        var g=new Gateway();var log=new Capture();using var h=Host(g,log);
        (await Send(h,"PII_ID\r\nFORGED",ev)).EnsureSuccessStatusCode();
        var row=Assert.Single(log.Rows);Assert.Null(row["ProviderPaymentId"]);
        Assert.Equal("not_attempted",row["Verification"]);Assert.Equal("ignored",row["Decision"]);
        Assert.DoesNotContain("PII_",JsonSerializer.Serialize(row));
    }
}
