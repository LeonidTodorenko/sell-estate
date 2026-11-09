using System.Data.Common;
using System.Reflection;
using RealEstateInvestment.Services;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;
using Xunit;

namespace RealEstateInvestment.Tests;

[Collection("Ledger292Postgres")]
public sealed class InvestmentWorkflow304Tests
{
    private static FinancialTestHost Host(bool pg = false, IInterceptor? interceptor = null) => new(interceptor: interceptor,
        isolatedPostgres: pg ? Environment.GetEnvironmentVariable("QA292_DB")! : null);
    private static async Task<Guid> Apply(FinancialTestHost h)
    {
        h.WithDb(db => { db.PaymentPlans.Single(x => x.PropertyId == h.PropertyId).Total = 10; db.SaveChanges(); });
        h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync("/api/investments/apply",
            new { propertyId = h.PropertyId, requestedShares = 4, pinOrPassword = "1111" })).StatusCode);
        Guid id = default; h.WithDb(db => id = db.InvestmentApplications.Single(x => x.PropertyId == h.PropertyId).Id);
        h.Login(h.Admin, role: "admin"); return id;
    }
    private static Task<HttpResponseMessage> Decide(FinancialTestHost h, Guid id, string action, int shares = 0, int step = 1, Guid? operation = null, string reason = "Reviewed funding") =>
        h.Client.PostAsJsonAsync($"/api/investment-workflow/applications/{id}/decision", new {
            operationId = operation ?? Guid.NewGuid(), action, approvedShares = shares, expectedStep = step, reason });

    [Theory]
    [InlineData("accept", 4, "accepted", 960, 76)]
    [InlineData("accept", 2, "partial", 980, 78)]
    [InlineData("reject", 0, "rejected", 1000, 80)]
    public async Task Reserved_basis_and_one_terminal_effect(string action, int shares, string status, int balance, int capacity)
    {
        using var h = Host(); var id = await Apply(h); var operation = Guid.NewGuid();
        h.WithDb(db => { db.Properties.Find(h.PropertyId)!.Price = 99999; db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.OK, (await Decide(h, id, action, shares, operation: operation)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Decide(h, id, action, shares, operation: operation)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Decide(h, id, "reject")).StatusCode);
        h.WithDb(db => {
            Assert.Equal(balance, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(capacity, db.Properties.Find(h.PropertyId)!.AvailableShares);
            Assert.Equal(status, db.InvestmentApplications.Find(id)!.Status);
            Assert.Equal(shares * 10, db.InvestmentApplications.Find(id)!.ApprovedAmount);
            Assert.Single(db.ActionLogs.Where(x => x.Action == "InvestmentApplicationDecision304" && x.UserId == h.Admin));
            Assert.Equal(shares < 4 ? 1 : 0, db.UserTransactions.Count(x => x.Type == TransactionType.InvestmentRefund));
            Assert.Single(db.UserTransactions.Where(x => x.Type == TransactionType.Investment));
            Assert.Equal(1 + (shares > 0 ? 1 : 0), db.Investments.Count(x => x.UserId == h.Actor));
        });
    }

    [Fact]
    public async Task Carry_retains_reservation_and_next_stage_can_be_decided_once()
    {
        using var h = Host(); var id = await Apply(h); var operation = Guid.NewGuid();
        h.WithDb(db => { db.PaymentPlans.Add(new PaymentPlan { PropertyId = h.PropertyId, EventDate = DateTime.UtcNow.AddDays(2), DueDate = DateTime.UtcNow.AddDays(3), Total = 10 }); db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.OK, (await Decide(h, id, "carry", operation: operation)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Decide(h, id, "carry", operation: operation)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Decide(h, id, "reject")).StatusCode);
        h.WithDb(db => { Assert.Equal(960, db.Users.Find(h.Actor)!.WalletBalance); Assert.Equal("carried", db.InvestmentApplications.Find(id)!.Status); Assert.Single(db.UserTransactions.Where(x=>x.UserId==h.Actor)); });
        Assert.Equal(HttpStatusCode.OK, (await Decide(h, id, "reject", step: 2)).StatusCode);
        h.WithDb(db => { Assert.Equal(1000, db.Users.Find(h.Actor)!.WalletBalance); Assert.Equal(80, db.Properties.Find(h.PropertyId)!.AvailableShares); });
    }

    [Fact]
    public async Task Guards_block_unproven_legacy_threshold_invalid_shares_and_missing_next_stage()
    {
        using var h = Host(); var id = await Apply(h);
        Assert.Equal(HttpStatusCode.BadRequest, (await Decide(h, id, "accept", 5)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Decide(h, id, "reject", reason: " ")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Decide(h, id, "carry")).StatusCode);
        h.WithDb(db => { db.PaymentPlans.Single().Total = 1000; db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.Conflict, (await Decide(h, id, "accept", 4)).StatusCode);
        h.WithDb(db => { db.ActionLogs.RemoveRange(db.ActionLogs); db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.Conflict, (await Decide(h, id, "reject")).StatusCode);
        h.WithDb(db => { Assert.Equal(960, db.Users.Find(h.Actor)!.WalletBalance); Assert.Equal("pending", db.InvestmentApplications.Find(id)!.Status); });
    }

    [Fact]
    public async Task Decision_RBAC_and_history_privacy_are_enforced()
    {
        using var h = Host(); var id = await Apply(h);
        h.Login(null); Assert.Equal(HttpStatusCode.Unauthorized, (await Decide(h, id, "reject")).StatusCode);
        h.Login(h.Actor); Assert.Equal(HttpStatusCode.Forbidden, (await Decide(h, id, "reject")).StatusCode);
        h.Login(h.Demo, demo: true, role: "admin"); Assert.Equal(HttpStatusCode.Forbidden, (await Decide(h, id, "reject")).StatusCode);
        h.Login(h.Other); Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync($"/api/investment-workflow/applications/{id}/history")).StatusCode);
        h.Login(h.Actor); Assert.Equal(HttpStatusCode.OK, (await h.Client.GetAsync($"/api/investment-workflow/applications/{id}/history")).StatusCode);
    }

    [Fact]
    public async Task Explicit_stage_quote_is_checked_but_original_UUID_retry_survives_stage_change()
    {
        using var h = Host(); h.Login(h.Actor); Guid stage = default;
        h.WithDb(db => stage = db.PaymentPlans.Single().Id);
        var key = Guid.NewGuid(); h.Client.DefaultRequestHeaders.Add("Idempotency-Key", key.ToString());
        var body = new { propertyId = h.PropertyId, requestedShares = 2, paymentPlanId = stage, stepNumber = 1, pinOrPassword = "1111" };
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync("/api/investments/apply", body)).StatusCode);
        h.WithDb(db => { db.PaymentPlans.Single().DueDate = DateTime.UtcNow.AddDays(-1); db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync("/api/investments/apply", body)).StatusCode);
        h.Client.DefaultRequestHeaders.Remove("Idempotency-Key");
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PostAsJsonAsync("/api/investments/apply", body with { paymentPlanId = Guid.NewGuid() })).StatusCode);
    }

    [Local292Theory]
    [InlineData("reject",0)] [InlineData("accept",2)] [InlineData("accept",4)]
    public async Task Concurrent_Postgres_decisions_commit_one_effect(string action,int shares)
    {
        var gate = new SaveGate(); using var h = Host(true,gate); var id = await Apply(h); gate.Enabled=true;
        var results=await Task.WhenAll(Decide(h,id,action,shares),Decide(h,id,"reject"));
        Assert.Single(results,x=>x.StatusCode==HttpStatusCode.OK);
        Assert.Single(results,x=>x.StatusCode==HttpStatusCode.Conflict);
        h.WithDb(db=> {
            var a=db.InvestmentApplications.Find(id)!;
            var amount=a.ApprovedAmount??0;
            Assert.Equal(1000-amount,db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(80-(a.ApprovedShares??0),db.Properties.Find(h.PropertyId)!.AvailableShares);
            Assert.Single(db.ActionLogs.Where(x=>x.Action=="InvestmentApplicationDecision304" && x.UserId==h.Admin));
        });
    }

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public Task SQLite_failure_rolls_back_all_decision_effects(bool atCommit) => Rollback(false, atCommit);
    [Local292Theory]
    [InlineData(false)] [InlineData(true)]
    public Task Postgres_failure_rolls_back_all_decision_effects(bool atCommit) => Rollback(true, atCommit);
    private static async Task Rollback(bool pg, bool atCommit)
    {
        var fault=new Failure { AtCommit=atCommit };using var h=Host(pg,fault);var id=await Apply(h);fault.Enabled=true;
        await Assert.ThrowsAsync<InvalidOperationException>(()=>Decide(h,id,"accept",2));
        h.WithDb(db=> {Assert.Equal("pending",db.InvestmentApplications.Find(id)!.Status);Assert.Equal(960,db.Users.Find(h.Actor)!.WalletBalance);Assert.Equal(76,db.Properties.Find(h.PropertyId)!.AvailableShares);Assert.Single(db.UserTransactions.Where(x=>x.UserId==h.Actor));Assert.Empty(db.ActionLogs.Where(x=>x.Action=="InvestmentApplicationDecision304" && x.UserId==h.Admin));Assert.Empty(db.Messages.Where(x=>x.RecipientId==h.Actor));Assert.Single(db.Investments.Where(x=>x.UserId==h.Actor));});
        fault.Enabled=false;Assert.Equal(HttpStatusCode.OK,(await Decide(h,id,"accept",2)).StatusCode);
    }
    [Fact]
    public async Task Legacy_scheduler_does_not_close_property_with_manual_carried_reservation()
    {
        using var h=Host();var id=await Apply(h);
        h.WithDb(db=>{db.PaymentPlans.Add(new PaymentPlan {PropertyId=h.PropertyId,EventDate=DateTime.UtcNow.AddDays(2),DueDate=DateTime.UtcNow.AddDays(3),Total=10});db.SaveChanges();});
        Assert.Equal(HttpStatusCode.OK,(await Decide(h,id,"carry")).StatusCode);
        h.WithDb(db=>{db.PaymentPlans.Single(x=>x.PropertyId==h.PropertyId&&x.EventDate<DateTime.UtcNow).DueDate=DateTime.UtcNow.AddHours(-1);db.SaveChanges();});
        await (Task)typeof(ScheduledTaskService).GetMethod("ProcessApplicationRound",BindingFlags.Instance|BindingFlags.NonPublic)!.Invoke(new ScheduledTaskService(h.Services,null!),new object[]{h.PropertyId})!;
        h.WithDb(db=>{Assert.Equal("carried",db.InvestmentApplications.Find(id)!.Status);Assert.NotEqual("declined",db.Properties.Find(h.PropertyId)!.Status);Assert.Equal(960,db.Users.Find(h.Actor)!.WalletBalance);});
    }

    [Fact]
    public Task SQLite_funded_round_uses_all_reservations_atomically() => FundedRound(false);
    [Local292Fact]
    public Task Postgres_funded_round_uses_all_reservations_atomically() => FundedRound(true);
    private static async Task FundedRound(bool pg)
    {
        using var h=Host(pg);var id=await Apply(h);
        h.Login(h.Other);
        Assert.Equal(HttpStatusCode.OK,(await h.Client.PostAsJsonAsync("/api/investments/apply",new {propertyId=h.PropertyId,requestedShares=4,pinOrPassword="2222"})).StatusCode);
        Guid[] ids=[];
        h.WithDb(db=>{db.PaymentPlans.Single(x=>x.PropertyId==h.PropertyId).Total=60;db.SaveChanges();ids=db.InvestmentApplications.Where(x=>x.PropertyId==h.PropertyId).Select(x=>x.Id).ToArray();});
        h.Login(h.Admin,role:"admin");
        Assert.Equal(HttpStatusCode.Conflict,(await Decide(h,id,"accept",4)).StatusCode);
        var operation=Guid.NewGuid();
        async Task<HttpResponseMessage> Round(Guid[] snapshot) => await h.Client.PostAsJsonAsync($"/api/investment-workflow/applications/{id}/decision",new {operationId=operation,action="accept-stage",approvedShares=0,expectedStep=1,expectedRound=snapshot,reason="Funded round independently reviewed"});
        Assert.Equal(HttpStatusCode.Conflict,(await Round([id])).StatusCode);
        h.WithDb(db=>{var user=db.Users.Find(h.Other)!;user.IsBlocked=true;db.SaveChanges();});
        Assert.Equal(HttpStatusCode.Conflict,(await Round(ids)).StatusCode);
        h.WithDb(db=>{Assert.All(db.InvestmentApplications.Where(x=>x.PropertyId==h.PropertyId),x=>Assert.Equal("pending",x.Status));Assert.Empty(db.ActionLogs.Where(x=>x.Action=="InvestmentApplicationDecision304"&&x.UserId==h.Admin));db.Users.Find(h.Other)!.IsBlocked=false;db.SaveChanges();});
        Assert.Equal(HttpStatusCode.OK,(await Round(ids)).StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await Round(ids)).StatusCode);
        h.WithDb(db=>{Assert.All(db.InvestmentApplications.Where(x=>x.PropertyId==h.PropertyId),x=>Assert.Equal("accepted",x.Status));Assert.Equal(80,db.PaymentPlans.Single(x=>x.PropertyId==h.PropertyId).Paid);Assert.Equal(960,db.Users.Find(h.Actor)!.WalletBalance);Assert.Equal(960,db.Users.Find(h.Other)!.WalletBalance);Assert.Equal(72,db.Properties.Find(h.PropertyId)!.AvailableShares);Assert.Equal(2,db.ActionLogs.Count(x=>x.Action=="InvestmentApplicationDecision304"&&x.UserId==h.Admin));Assert.Equal(2,db.UserTransactions.Count(x=>x.PropertyId==h.PropertyId));});
    }

    [Fact]
    public async Task Outstanding_reservations_lock_plan_numbering_and_funding_terms()
    {
        using var h=Host();await Apply(h);Guid stage=default;h.WithDb(db=>stage=db.PaymentPlans.Single().Id);
        var plan=new PaymentPlan {Milestone="Locked stage",PropertyId=h.PropertyId,EventDate=DateTime.UtcNow.AddDays(-1),DueDate=DateTime.UtcNow.AddDays(1),Total=10};
        var path=$"/api/properties/{h.PropertyId}/payment-plans";
        Assert.Equal(HttpStatusCode.Conflict,(await h.Client.PostAsJsonAsync(path,plan)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await h.Client.PutAsJsonAsync($"{path}/{stage}",plan)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await h.Client.DeleteAsync($"{path}/{stage}")).StatusCode);
        h.WithDb(db=>{Assert.Single(db.PaymentPlans);Assert.Equal(960,db.Users.Find(h.Actor)!.WalletBalance);});
    }

    private sealed class SaveGate:SaveChangesInterceptor
    {
        public bool Enabled;private int calls;private readonly TaskCompletionSource gate=new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData data,InterceptionResult<int> result,CancellationToken token=default)
        {if(Enabled&&Interlocked.Increment(ref calls)<=2){if(calls==2)gate.TrySetResult();await gate.Task.WaitAsync(TimeSpan.FromSeconds(15));}return result;}
    }
    private sealed class Failure:DbTransactionInterceptor, ISaveChangesInterceptor
    {
        public bool Enabled;
        public bool AtCommit;
        public override ValueTask<InterceptionResult> TransactionCommittingAsync(DbTransaction transaction, TransactionEventData data, InterceptionResult result, CancellationToken token=default)
        { if(Enabled&&AtCommit)throw new InvalidOperationException("Injected commit failure");return ValueTask.FromResult(result); }
        public ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData data,int result,CancellationToken token=default)
        {if(Enabled&&!AtCommit)throw new InvalidOperationException("Injected decision failure");return ValueTask.FromResult(result);}
    }
}
