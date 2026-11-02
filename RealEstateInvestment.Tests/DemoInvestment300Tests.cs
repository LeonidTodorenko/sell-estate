using System.Net;
using System.Net.Http.Json;
using RealEstateInvestment.Enums;
using Xunit;

namespace RealEstateInvestment.Tests;
public sealed class DemoInvestment300Tests
{
    private static async Task<HttpResponseMessage> Buy(FinancialTestHost h, Guid id, int shares=2, int step=1, string pin="4444", Guid? property=null)
    {
        using var request=new HttpRequestMessage(HttpMethod.Post,"/api/investments/apply");
        request.Headers.Add("Idempotency-Key",id.ToString());
        request.Content=JsonContent.Create(new {userId=h.Other,propertyId=property??h.PropertyId,requestedShares=shares,stepNumber=step,pinOrPassword=pin});
        return await h.Client.SendAsync(request);
    }
    [Theory]
    [InlineData(true)] [InlineData(false)]
    public async Task Lost_response_replay_preserves_single_debit_and_journal_even_after_property_closes(bool pending)
    {
        using var h=new FinancialTestHost();h.Login(h.Demo,demo:true);var id=Guid.NewGuid();
        if(!pending)h.WithDb(db=>{var p=db.PaymentPlans.Single();p.EventDate=DateTime.UtcNow.AddDays(-3);p.DueDate=DateTime.UtcNow.AddDays(-1);db.SaveChanges();});
        Assert.Equal(HttpStatusCode.OK,(await Buy(h,id)).StatusCode);
        h.WithDb(db=>{var p=db.Properties.Find(h.PropertyId)!;p.Status="sold";p.Price=9999;db.SaveChanges();});
        Assert.Equal(HttpStatusCode.OK,(await Buy(h,id)).StatusCode);
        h.WithDb(db=>{
            Assert.Equal(980,db.DemoUsers.Find(h.Demo)!.WalletBalance);
            var t=Assert.Single(db.DemoUserTransactions);Assert.Equal(id,t.Id);Assert.Equal(h.Demo,t.DemoUserId);Assert.Equal(20,t.Amount);
            var log=Assert.Single(db.DemoActionLogs);Assert.Contains(id.ToString(),log.Details);Assert.DoesNotContain("4444",log.Details);
            Assert.Empty(db.UserTransactions);Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);
            if(pending)Assert.Single(db.DemoInvestmentApplications);else Assert.Empty(db.DemoInvestmentApplications);
        });
    }
    [Fact]
    public async Task Altered_payload_or_owner_conflicts_and_invalid_secret_never_replays()
    {
        using var h=new FinancialTestHost();h.Login(h.Demo,demo:true);var id=Guid.NewGuid();
        Assert.Equal(HttpStatusCode.OK,(await Buy(h,id)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await Buy(h,id,shares:3)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await Buy(h,id,step:2)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await Buy(h,id,property:Guid.NewGuid())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await Buy(h,id,pin:"bad")).StatusCode);
        h.Login(h.DemoOther,demo:true);
        Assert.Equal(HttpStatusCode.Conflict,(await Buy(h,id,pin:"5555")).StatusCode);
        h.WithDb(db=>{Assert.Single(db.DemoUserTransactions);Assert.Single(db.DemoActionLogs);Assert.Equal(1000,db.DemoUsers.Find(h.DemoOther)!.WalletBalance);});
    }
    [Theory]
    [InlineData("bad")] [InlineData("00000000-0000-0000-0000-000000000000")]
    public async Task Invalid_key_never_debits(string key)
    {
        using var h=new FinancialTestHost();h.Login(h.Demo,demo:true);
        h.Client.DefaultRequestHeaders.Add("Idempotency-Key",key);
        Assert.Equal(HttpStatusCode.BadRequest,(await h.Client.PostAsJsonAsync("/api/investments/apply",new {propertyId=h.PropertyId,requestedShares=2,pinOrPassword="4444"})).StatusCode);
        h.WithDb(db=>{Assert.Empty(db.DemoUserTransactions);Assert.Equal(1000,db.DemoUsers.Find(h.Demo)!.WalletBalance);});
    }
}
