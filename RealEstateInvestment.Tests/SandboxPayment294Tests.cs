using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using Xunit;

namespace RealEstateInvestment.Tests;

public class WalletPayment294Tests
{
    private sealed class Gateway : IYooKassaPayments
    {
        public VerifiedPayment? Result;
        public int Creates;
        public bool LoseCreateResponseOnce;
        public Action? BeforeCreateResponse;
        public Task<VerifiedPayment> Create(WalletPayment p, CancellationToken ct)
        {
            Creates++;
            Result ??= new("provider-"+p.Id, "pending", true, false, "1514010", p.Amount, "RUB", p.Id, "https://yoomoney.ru/checkout/test");
            if(LoseCreateResponseOnce){LoseCreateResponseOnce=false;throw new HttpRequestException("Simulated lost response");}
            var response=Result;BeforeCreateResponse?.Invoke();
            return Task.FromResult(response);
        }
        public Task<VerifiedPayment> Get(string id, CancellationToken ct) => Task.FromResult(Result!);
    }
    private static FinancialTestHost Host(Gateway g, string? postgres=null) => new(s =>
    {
        s.AddSingleton<IYooKassaPayments>(g);
        s.AddSingleton(Options.Create(new PaymentOptions { Enabled=true, ShopId="1514010", SecretKey="test_fixture_not_a_real_key", ReturnUrl="http://localhost:5173/topup", ChargeUnitsPerWalletUnit=100 }));
        s.AddScoped<PaymentService>();
    }, isolatedPostgres:postgres);
    private static async Task<Guid> Create(FinancialTestHost h, Guid key, decimal amount=100)
    {
        var response=await h.Client.PostAsJsonAsync("/api/payments", new { requestKey=key, amount=amount });
        response.EnsureSuccessStatusCode();
        var p=await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        return p.GetProperty("id").GetGuid();
    }
    private static void Credit(FinancialTestHost h, Guid id, Gateway g)
    {
        using var scope=h.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<PaymentService>().Reconcile(id,g.Result!.Id,default).GetAwaiter().GetResult();
    }
    [Fact] public async Task Duplicate_create_and_success_credit_once_with_both_journals()
    {
        var g=new Gateway();using var h=Host(g);h.Login(h.Actor);var key=Guid.NewGuid();var id=await Create(h,key);
        Assert.Equal(id,await Create(h,key));Assert.Equal(1,g.Creates);
        g.Result=g.Result! with { Status="succeeded", Paid=true };Credit(h,id,g);Credit(h,id,g);
        h.WithDb(db=>{Assert.Equal(1001,db.Users.Find(h.Actor)!.WalletBalance);Assert.Single(db.UserTransactions.Where(x=>x.Id==id));Assert.Single(db.ActionLogs.Where(x=>x.Id==id));});
        Assert.Equal(HttpStatusCode.Conflict,(await h.Client.PostAsJsonAsync("/api/payments",new{requestKey=key,amount=200})).StatusCode);
    }
    [Theory] [InlineData("live")] [InlineData("amount")] [InlineData("currency")] [InlineData("shop")] [InlineData("correlation")] [InlineData("unpaid")]
    public async Task Mismatch_never_credits(string kind)
    {
        var g=new Gateway();using var h=Host(g);h.Login(h.Actor);var id=await Create(h,Guid.NewGuid());
        g.Result=g.Result! with {Status="succeeded",Paid=kind!="unpaid",Test=kind!="live",Amount=kind=="amount"?999:100,Currency=kind=="currency"?"USD":"RUB",ShopId=kind=="shop"?"other":"1514010",Correlation=kind=="correlation"?Guid.NewGuid():id};
        Assert.Throws<InvalidOperationException>(()=>Credit(h,id,g));
        h.WithDb(db=>{Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Empty(db.UserTransactions);Assert.Empty(db.ActionLogs);});
    }
    [Fact] public async Task Canceled_pending_and_forged_webhook_do_not_credit()
    {
        var g=new Gateway();using var h=Host(g);h.Login(h.Actor);var id=await Create(h,Guid.NewGuid());
        var response=await h.Client.PostAsJsonAsync("/api/payments/webhook",new{ @event="payment.succeeded", @object=new{id=g.Result!.Id, status="succeeded"}});
        response.EnsureSuccessStatusCode();Credit(h,id,g);
        g.Result=g.Result! with {Status="canceled"};Credit(h,id,g);Credit(h,id,g);
        h.WithDb(db=>{Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Empty(db.UserTransactions);Assert.Empty(db.ActionLogs);Assert.Equal("canceled",db.Payments.Find(id)!.Status);});
    }
    [Fact] public async Task Ownership_authentication_and_demo_are_enforced()
    {
        var g=new Gateway();using var h=Host(g);h.Login(h.Actor);var id=await Create(h,Guid.NewGuid());
        h.Login(h.Other);Assert.Equal(HttpStatusCode.NotFound,(await h.Client.GetAsync($"/api/payments/{id}")).StatusCode);
        h.Login(h.Demo,true);Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.PostAsJsonAsync("/api/payments",new{requestKey=Guid.NewGuid(),amount=100})).StatusCode);
        h.Login(null);Assert.Equal(HttpStatusCode.Unauthorized,(await h.Client.GetAsync("/api/payments/config")).StatusCode);
    }
    [Fact] public async Task Ledger_failure_rolls_back_balance_and_payment_marker()
    {
        var g=new Gateway();using var h=Host(g);h.Login(h.Actor);var id=await Create(h,Guid.NewGuid());
        h.WithDb(db=>{db.UserTransactions.Add(new(){Id=id,UserId=h.Actor,Amount=1,Type=RealEstateInvestment.Enums.TransactionType.Deposit,Timestamp=DateTime.UtcNow});db.SaveChanges();});
        g.Result=g.Result! with {Status="succeeded",Paid=true};Assert.Throws<DbUpdateException>(()=>Credit(h,id,g));
        h.WithDb(db=>{Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Null(db.Payments.Find(id)!.CreditedAt);Assert.Empty(db.ActionLogs);});
    }

    [Fact] public async Task Lost_create_response_reuses_durable_payment_and_provider_key()
    {
        var g=new Gateway{LoseCreateResponseOnce=true};using var h=Host(g);h.Login(h.Actor);var key=Guid.NewGuid();
        Assert.Equal(HttpStatusCode.ServiceUnavailable,(await h.Client.PostAsJsonAsync("/api/payments",new{requestKey=key,amount=100})).StatusCode);
        var remoteId=g.Result!.Correlation;Assert.Equal(remoteId,await Create(h,key));
        h.WithDb(db=>{Assert.Single(db.Payments);Assert.Empty(db.UserTransactions);});
    }

    [Fact] public async Task Webhook_before_create_response_is_correlated_and_not_overwritten()
    {
        var g=new Gateway();using var h=Host(g);h.Login(h.Actor);
        g.BeforeCreateResponse=()=>{g.Result=g.Result! with{Status="succeeded",Paid=true};Credit(h,g.Result.Correlation,g);};
        var id=await Create(h,Guid.NewGuid());
        h.WithDb(db=>{Assert.Equal(1001,db.Users.Find(h.Actor)!.WalletBalance);Assert.Equal("succeeded",db.Payments.Find(id)!.Status);Assert.Single(db.UserTransactions);});
    }

    [Local294Fact] public async Task Postgres_competing_webhooks_credit_once_and_rollback_is_atomic()
    {
        var connection=Environment.GetEnvironmentVariable("QA294_DB");
        if(string.IsNullOrEmpty(connection)) throw new InvalidOperationException("Set QA294_DB to the isolated local fixture");
        var g=new Gateway();using var h=Host(g,connection);h.Login(h.Actor);var id=await Create(h,Guid.NewGuid());
        g.Result=g.Result! with {Status="succeeded",Paid=true};
        await Task.WhenAll(Enumerable.Range(0,12).Select(_=>Task.Run(()=>Credit(h,id,g))));
        h.WithDb(db=>{Assert.Equal(1001,db.Users.Find(h.Actor)!.WalletBalance);Assert.Single(db.UserTransactions.Where(x=>x.Id==id));Assert.Single(db.ActionLogs.Where(x=>x.Id==id));});
        g.Result=null;var second=await Create(h,Guid.NewGuid());g.Result=g.Result! with {Status="succeeded",Paid=true};
        h.WithDb(db=>{db.UserTransactions.Add(new(){Id=second,UserId=h.Actor,Amount=1,Type=RealEstateInvestment.Enums.TransactionType.Deposit,Timestamp=DateTime.UtcNow});db.SaveChanges();});
        Assert.Throws<DbUpdateException>(()=>Credit(h,second,g));
        h.WithDb(db=>{Assert.Equal(1001,db.Users.Find(h.Actor)!.WalletBalance);Assert.Null(db.Payments.Find(second)!.CreditedAt);Assert.Empty(db.ActionLogs.Where(x=>x.Id==second));});
    }
}

internal sealed class Local294FactAttribute : FactAttribute
{
    public Local294FactAttribute()
    {
        if(string.IsNullOrEmpty(Environment.GetEnvironmentVariable("QA294_DB"))) Skip="Requires explicitly isolated local PostgreSQL QA294_DB";
    }
}
