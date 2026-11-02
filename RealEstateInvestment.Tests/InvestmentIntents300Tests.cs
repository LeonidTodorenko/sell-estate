using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;
using Xunit;

namespace RealEstateInvestment.Tests;
public sealed class InvestmentIntents300Tests
{
    private static string Path(Guid id) => $"/api/admin/investment-intents/{id}";
    private static Guid Seed(FinancialTestHost h, bool withSource = true)
    {
        var id = Guid.NewGuid();
        h.WithDb(db => {
            var source = db.Investments.Single(x => x.UserId == h.Actor).Id;
            db.UserTransactions.Add(new UserTransaction { Id = id, UserId = h.Actor, PropertyId = h.PropertyId,
                Type = TransactionType.Investment, Amount = 100, Shares = 10, Timestamp = DateTime.UtcNow });
            if(withSource) db.ActionLogs.Add(new ActionLog { UserId = h.Actor, Action = "ApplicateForInvestment",
                Details = JsonSerializer.Serialize(new { transactionId = id, affectedUser = h.Actor, propertyId = h.PropertyId, amount = 100, shares = 10, sourceId = source }) });
            db.SaveChanges();
        }); return id;
    }
    private static object Request(FinancialTestHost h, bool verified = true, decimal amount = 100) => new {
        userId = h.Actor, propertyId = h.PropertyId, amount, shares = 10, independentlyVerified = verified, reference = "QA300_RECONCILED" };

    [Theory]
    [InlineData("anonymous")] [InlineData("investor")] [InlineData("forgedAdmin")] [InlineData("demoAdmin")] [InlineData("blockedAdmin")] [InlineData("deletedAdmin")]
    public async Task Non_current_admin_cannot_read_or_verify(string actor)
    {
        using var h = new FinancialTestHost(); var id = Seed(h);
        if(actor == "anonymous") h.Login(null);
        if(actor == "investor") h.Login(h.Actor);
        if(actor == "forgedAdmin") h.Login(h.Actor, role:"admin");
        if(actor == "demoAdmin") h.Login(h.Demo, demo:true, role:"admin");
        if(actor is "blockedAdmin" or "deletedAdmin") {
            h.WithDb(db => { var a=db.Users.Find(h.Admin)!; if(actor=="blockedAdmin")a.IsBlocked=true;else a.IsDeleted=true;db.SaveChanges(); });
            h.Login(h.Admin, role:"admin");
        }
        Assert.Equal(actor=="anonymous"?HttpStatusCode.Unauthorized:HttpStatusCode.Forbidden,(await h.Client.GetAsync(Path(id))).StatusCode);
        Assert.Equal(actor=="anonymous"?HttpStatusCode.Unauthorized:HttpStatusCode.Forbidden,(await h.Client.PostAsJsonAsync(Path(id)+"/verify-commit",Request(h))).StatusCode);
        h.WithDb(db=>Assert.DoesNotContain(db.ActionLogs,x=>x.Action=="InvestmentIntentCommitVerified"));
    }
    [Theory]
    [InlineData("approve")] [InlineData("reject")]
    public async Task Legacy_admin_actions_cannot_bypass_ledger(string action)
    {
        using var h=new FinancialTestHost();h.Login(h.Admin,role:"admin");Guid id=default;
        h.WithDb(db=>id=db.Investments.Single().Id);
        Assert.Equal(HttpStatusCode.Gone,(await h.Client.PostAsync($"/api/admin/investments/{id}/{action}",null)).StatusCode);
        h.WithDb(db=>{Assert.Equal(10,db.Investments.Single().Shares);Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Empty(db.UserTransactions);});
    }
    [Fact]
    public async Task Unknown_is_not_resettable_and_cannot_be_verified()
    {
        using var h=new FinancialTestHost();h.Login(h.Admin,role:"admin");var id=Guid.NewGuid();
        var d=await h.Client.GetFromJsonAsync<JsonElement>(Path(id));Assert.Equal("unknown",d.GetProperty("status").GetString());Assert.False(d.GetProperty("canReset").GetBoolean());
        Assert.Equal(HttpStatusCode.Conflict,(await h.Client.PostAsJsonAsync(Path(id)+"/verify-commit",Request(h))).StatusCode);
    }
    [Theory]
    [InlineData(false,100,true,HttpStatusCode.BadRequest)]
    [InlineData(true,101,true,HttpStatusCode.Conflict)]
    [InlineData(true,100,false,HttpStatusCode.Conflict)]
    public async Task Unverified_mismatch_or_missing_source_cannot_resolve(bool verified,int amount,bool source,HttpStatusCode expected)
    {
        using var h=new FinancialTestHost();var id=Seed(h,source);h.Login(h.Admin,role:"admin");
        Assert.Equal(expected,(await h.Client.PostAsJsonAsync(Path(id)+"/verify-commit",Request(h,verified,amount))).StatusCode);
        h.WithDb(db=>Assert.DoesNotContain(db.ActionLogs,x=>x.Action=="InvestmentIntentCommitVerified"));
    }
    [Fact]
    public async Task Verified_commit_is_audited_with_real_actor_and_never_moves_money()
    {
        using var h=new FinancialTestHost();var id=Seed(h);h.Login(h.Admin,role:"admin");
        var d=await h.Client.GetFromJsonAsync<JsonElement>(Path(id));Assert.Equal("committed",d.GetProperty("status").GetString());
        h.WithDb(db=>Assert.DoesNotContain(db.ActionLogs,x=>x.Action=="InvestmentIntentCommitVerified"));
        for(var i=0;i<2;i++)Assert.Equal(HttpStatusCode.OK,(await h.Client.PostAsJsonAsync(Path(id)+"/verify-commit",Request(h))).StatusCode);
        h.WithDb(db=>{Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Single(db.UserTransactions);Assert.Equal(10,db.Investments.Single().Shares);
            var logs=db.ActionLogs.Where(x=>x.Action=="InvestmentIntentCommitVerified").ToList();Assert.Equal(2,logs.Count);
            Assert.All(logs,l=>{Assert.Equal(h.Admin,l.UserId);using var json=JsonDocument.Parse(l.Details);Assert.Equal(id,json.RootElement.GetProperty("operationId").GetGuid());Assert.DoesNotContain("1111",l.Details);});});
    }
}
