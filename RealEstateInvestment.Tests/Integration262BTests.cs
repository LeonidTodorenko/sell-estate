using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Models;
using RealEstateInvestment.Enums;
using Xunit;
using System.Reflection;
using Microsoft.Extensions.DependencyInjection;
using RealEstateInvestment.Services;
namespace RealEstateInvestment.Tests;

// Only the named local restore is accepted by FinancialTestHost. All actors have random IDs.
[Collection("RestoredPostgres")]
public sealed class Integration262BTests
{
    private static FinancialTestHost Host() => new(services=>services.AddSingleton<IFirebaseNotificationService>(new NoPush()), isolatedPostgres: Environment.GetEnvironmentVariable("QA262B_DB") ?? throw new InvalidOperationException("Local restore required"));
    private static async Task Ok(HttpResponseMessage r) => Assert.True(r.IsSuccessStatusCode, $"HTTP {(int)r.StatusCode}: {await r.Content.ReadAsStringAsync()}");
    private static async Task<Guid> CreateOffer(FinancialTestHost h)
    {
        h.Login(h.Actor);
        var r=await h.Client.PostAsJsonAsync("/api/share-offers",new {propertyId=h.PropertyId,sharesForSale=2,startPricePerShare=10,buyoutPricePerShare=20,expirationDate=DateTime.UtcNow.AddDays(1),pinOrPassword="plain-1111"});
        await Ok(r);
        Guid id=default; h.WithDb(db=>id=db.ShareOffers.Single(x=>x.SellerId==h.Actor&&x.PropertyId==h.PropertyId).Id);return id;
    }
    [Local262BFact]
    public async Task Offer_bid_buy_referral_conserves_wallets_shares_cost_basis_and_rejects_replay()
    {
        using var h=Host();
        h.WithDb(db=>{db.Referrals.Add(new Referral {Id=Guid.NewGuid(),InviterUserId=h.Other,RefereeUserId=h.Actor,ReferrerRewardPercent=.05m,RewardValidUntil=DateTime.UtcNow.AddYears(1)});db.SaveChanges();});
        var id=await CreateOffer(h);
        h.Login(h.Other);
        await Ok(await h.Client.PostAsJsonAsync($"/api/share-offers/{id}/bid",new {bidPricePerShare=15,shares=2,pinOrPassword="2222"}));
        h.WithDb(db=>{Assert.Equal(1000,db.Users.Find(h.Other)!.WalletBalance);Assert.Single(db.ShareOfferBids.Where(x=>x.OfferId==id));});
        await Ok(await h.Client.PostAsJsonAsync($"/api/share-offers/{id}/buy",new {sharesToBuy=2,pinOrPassword="plain-2222"}));
        Assert.Equal(HttpStatusCode.NotFound,(await h.Client.PostAsJsonAsync($"/api/share-offers/{id}/buy",new {sharesToBuy=2,pinOrPassword="2222"})).StatusCode);
        h.WithDb(db=>{
            var users=db.Users.Where(x=>x.Id==h.Actor||x.Id==h.Other||x.Id==h.Admin).ToList();
            Assert.Equal(3000,users.Sum(x=>x.WalletBalance));
            Assert.Equal(1038.60m,users.Single(x=>x.Id==h.Actor).WalletBalance);
            Assert.Equal(960.07m,users.Single(x=>x.Id==h.Other).WalletBalance);
            Assert.Equal(1001.33m,users.Single(x=>x.Id==h.Admin).WalletBalance);
            var inv=db.Investments.Where(x=>x.PropertyId==h.PropertyId).ToList();Assert.Equal(10,inv.Sum(x=>x.Shares));
            Assert.Equal(80,inv.Where(x=>x.UserId==h.Actor).Sum(x=>x.InvestedAmount));
            Assert.Equal(40,inv.Where(x=>x.UserId==h.Other).Sum(x=>x.InvestedAmount));
            Assert.False(db.ShareOffers.Find(id)!.IsActive);
            Assert.Single(db.UserTransactions.Where(x=>x.PropertyId==h.PropertyId&&x.Type==TransactionType.ReferralReward));
        });
    }
    [Local262BFact]
    public async Task Create_cancel_returns_locked_ownership_once()
    {
        using var h=Host();decimal fee=0;h.WithDb(db=>{fee=decimal.Parse(db.SystemSettings.Single(x=>x.Key=="CancelListingFee").Value);});var id=await CreateOffer(h);
        await Ok(await h.Client.PostAsJsonAsync($"/api/share-offers/{id}/cancel",new {pinOrPassword="plain-1111"}));
        Assert.Equal(HttpStatusCode.NotFound,(await h.Client.PostAsJsonAsync($"/api/share-offers/{id}/cancel",new {pinOrPassword="1111"})).StatusCode);
        h.WithDb(db=>{var inv=db.Investments.Where(x=>x.UserId==h.Actor&&x.PropertyId==h.PropertyId).ToList();Assert.Equal(10,inv.Sum(x=>x.Shares));Assert.Equal(100,inv.Sum(x=>x.InvestedAmount));Assert.Equal(1000-fee,db.Users.Find(h.Actor)!.WalletBalance);Assert.Equal(1000+fee,db.Users.Find(h.Admin)!.WalletBalance);});
    }
    [Local262BFact]
    public async Task Buyback_transfers_platform_cash_and_ownership_once()
    {
        using var h=Host();h.Login(h.Actor);var req=new {propertyId=h.PropertyId,pinOrPassword="plain-1111"};
        await Ok(await h.Client.PostAsJsonAsync("/api/share-offers/sell-to-platform",req));
        Assert.Equal(HttpStatusCode.BadRequest,(await h.Client.PostAsJsonAsync("/api/share-offers/sell-to-platform",req)).StatusCode);
        h.WithDb(db=>{Assert.Equal(1100,db.Users.Find(h.Actor)!.WalletBalance);Assert.Equal(900,db.Users.Find(h.Admin)!.WalletBalance);Assert.Empty(db.Investments.Where(x=>x.UserId==h.Actor&&x.PropertyId==h.PropertyId));Assert.Equal(10,db.Investments.Where(x=>x.UserId==h.Admin&&x.PropertyId==h.PropertyId).Sum(x=>x.Shares));});
    }
    [Local262BFact]
    public async Task Competing_withdrawals_cannot_overdraw_and_reject_refunds_exactly_once()
    {
        using var h=Host();h.Login(h.Actor);
        var results=await Task.WhenAll(Enumerable.Range(0,2).Select(_=>h.Client.PostAsJsonAsync("/api/withdrawals/request",new {amount=700m})));
        Assert.Equal(1,results.Count(x=>x.IsSuccessStatusCode));
        Assert.All(results.Where(x=>!x.IsSuccessStatusCode),r=>Assert.Contains(r.StatusCode,new[]{HttpStatusCode.Conflict,HttpStatusCode.BadRequest}));
        Guid id=default;h.WithDb(db=>{Assert.Equal(300,db.Users.Find(h.Actor)!.WalletBalance);id=db.WithdrawalRequests.Single(x=>x.UserId==h.Actor).Id;Assert.Single(db.UserTransactions.Where(x=>x.UserId==h.Actor));});
        h.Login(h.Other);Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.PostAsJsonAsync($"/api/withdrawals/{id}/reject",new {})).StatusCode);
        h.Login(h.Admin,role:"admin");await Ok(await h.Client.PostAsJsonAsync($"/api/withdrawals/{id}/reject",new {}));
        Assert.Equal(HttpStatusCode.Conflict,(await h.Client.PostAsJsonAsync($"/api/withdrawals/{id}/reject",new {})).StatusCode);
        h.WithDb(db=>{Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Equal(2,db.UserTransactions.Count(x=>x.UserId==h.Actor));});
    }
    [Local262BFact]
    public async Task Application_reserves_cash_and_capacity_and_rent_pays_once()
    {
        using var h=Host();h.Login(h.Actor);
        await Ok(await h.Client.PostAsJsonAsync("/api/investments/apply",new {propertyId=h.PropertyId,requestedShares=2,stepNumber=1,pinOrPassword="plain-1111"}));
        h.WithDb(db=>{Assert.Equal(980,db.Users.Find(h.Actor)!.WalletBalance);Assert.Equal(78,db.Properties.Find(h.PropertyId)!.AvailableShares);var a=db.InvestmentApplications.Single(x=>x.UserId==h.Actor&&x.PropertyId==h.PropertyId);Assert.Equal(20,a.RequestedAmount);Assert.Equal(2,a.RequestedShares);Assert.Equal(20,db.UserTransactions.Where(x=>x.UserId==h.Actor).Sum(x=>x.Amount));});
        h.WithDb(db=>{var step=db.PaymentPlans.Single(x=>x.PropertyId==h.PropertyId);step.Total=20;step.DueDate=DateTime.UtcNow.AddMinutes(-1);db.SaveChanges();});
        var service=new ScheduledTaskService(h.Services,null!);
        var method=typeof(ScheduledTaskService).GetMethod("ProcessApplicationRound",BindingFlags.Instance|BindingFlags.NonPublic)!;
        await (Task)method.Invoke(service,new object[]{h.PropertyId})!;
        await (Task)method.Invoke(service,new object[]{h.PropertyId})!;
        h.WithDb(db=>{Assert.Equal("accepted",db.InvestmentApplications.Single(x=>x.UserId==h.Actor&&x.PropertyId==h.PropertyId).Status);Assert.Equal(20,db.PaymentPlans.Single(x=>x.PropertyId==h.PropertyId).Paid);Assert.Equal(12,db.Investments.Where(x=>x.PropertyId==h.PropertyId&&x.UserId==h.Actor).Sum(x=>x.Shares));Assert.Equal(980,db.Users.Find(h.Actor)!.WalletBalance);});
        h.Login(h.Admin,role:"admin");var route=$"/api/properties/{h.PropertyId}/pay-rent";
        await Ok(await h.Client.PostAsJsonAsync(route,new {customAmount=100m}));
        Assert.Equal(HttpStatusCode.Conflict,(await h.Client.PostAsJsonAsync(route,new {customAmount=100m})).StatusCode);
        h.WithDb(db=>{Assert.Equal(992,db.Users.Find(h.Actor)!.WalletBalance);Assert.Equal(3,db.UserTransactions.Count(x=>x.UserId==h.Actor));Assert.Equal(12,db.UserTransactions.Where(x=>x.UserId==h.Actor&&x.Type==TransactionType.RentIncome).Sum(x=>x.Amount));});
    }
    [Local262BFact]
    public async Task Kyc_and_chat_use_current_actor_and_reject_unrelated_reader()
    {
        using var h=Host();h.Login(h.Actor);
        await Ok(await h.Client.PostAsJsonAsync("/api/kyc/upload",new {userId=h.Other,base64File="cWEyNjJiLXRlc3Q=",status="verified",type="test-only"}));
        Guid doc=default;h.WithDb(db=>{var d=db.KycDocuments.Single(x=>x.UserId==h.Actor);doc=d.Id;Assert.Equal("pending",d.Status);});
        h.Login(h.Other);Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.PostAsJsonAsync($"/api/kyc/{doc}/delete",new {})).StatusCode);
        h.Login(h.Actor);await Ok(await h.Client.PostAsJsonAsync($"/api/kyc/{doc}/delete",new {}));
        await Ok(await h.Client.PostAsJsonAsync("/api/chat/send",new {senderId=h.Admin,recipientId=h.Other,content="  isolated QA 262B  "}));
        h.WithDb(db=>{var m=db.ChatMessages.Single(x=>x.SenderId==h.Actor);Assert.Equal(h.Other,m.RecipientId);Assert.Equal("isolated QA 262B",m.Content);});
        await Ok(await h.Client.GetAsync($"/api/chat/conversation/{h.Actor}/{h.Other}"));
        h.Login(h.Other);await Ok(await h.Client.GetAsync($"/api/chat/conversation/{h.Actor}/{h.Other}"));
        h.Login(h.Actor);Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.GetAsync($"/api/chat/conversation/{h.Other}/{h.Admin}")).StatusCode);
        h.Login(h.Demo,demo:true);Assert.Equal(HttpStatusCode.BadRequest,(await h.Client.PostAsJsonAsync("/api/chat/send",new {recipientId=h.Other,content="must not send"})).StatusCode);
    }

    private sealed class NoPush:IFirebaseNotificationService {public Task SendNotificationAsync(string token,string title,string body)=>throw new InvalidOperationException("External push forbidden in QA");}
}
public sealed class Local262BFactAttribute:FactAttribute
{
    public Local262BFactAttribute(){if(string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("QA262B_DB")))Skip="Requires named local restored PostgreSQL";}
}
