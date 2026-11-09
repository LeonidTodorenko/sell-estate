using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using Xunit;

namespace RealEstateInvestment.Tests;

[Collection("Ledger292Postgres")]
public sealed class Scheduler3041Tests
{
    private static FinancialTestHost Host(IInterceptor? fault = null, bool pg = true) => new(interceptor: fault,
        isolatedPostgres: pg ? Environment.GetEnvironmentVariable("QA292_DB")! : null);
    private static Task Run(FinancialTestHost h, bool discovery = false) => (Task)typeof(ScheduledTaskService)
        .GetMethod(discovery ? "RunScheduledProperyStatusTask" : "ProcessApplicationRound", BindingFlags.Instance | BindingFlags.NonPublic)!
        .Invoke(new ScheduledTaskService(h.Services, null!), discovery ? null : [h.PropertyId])!;
    private static async Task<Guid> Reserve(FinancialTestHost h, bool other = false)
    {
        h.Login(other ? h.Other : h.Actor);
        var r = await h.Client.PostAsJsonAsync("/api/investments/apply",new {propertyId=h.PropertyId,requestedShares=4,pinOrPassword=other?"2222":"1111"});
        Assert.Equal(HttpStatusCode.OK,r.StatusCode);
        Guid id=default; h.WithDb(db=>id=db.InvestmentApplications.Single(x=>x.UserId==(other?h.Other:h.Actor)&&x.PropertyId==h.PropertyId).Id);
        return id;
    }
    private static Task<HttpResponseMessage> Decision(FinancialTestHost h, Guid id, string action, int shares = 0, int step = 1) =>
        h.Client.PostAsJsonAsync($"/api/investment-workflow/applications/{id}/decision",new {operationId=Guid.NewGuid(),action,reason="Scheduler race QA",approvedShares=shares,expectedStep=step,expectedRound=new[]{id}});
    private static async Task Later(FinancialTestHost h, Guid id)
    {
        h.WithDb(db=>{db.PaymentPlans.Add(new PaymentPlan {PropertyId=h.PropertyId,EventDate=DateTime.UtcNow.AddDays(2),DueDate=DateTime.UtcNow.AddDays(3),Total=60});db.SaveChanges();});
        h.Login(h.Admin,role:"admin"); Assert.Equal(HttpStatusCode.OK,(await Decision(h,id,"carry")).StatusCode);
    }
    private static void Due(FinancialTestHost h, decimal target, decimal paid = 0, bool later = false) => h.WithDb(db=>{
        var plans=db.PaymentPlans.Where(x=>x.PropertyId==h.PropertyId).OrderBy(x=>x.EventDate).ToList();
        foreach(var p in plans) p.DueDate=DateTime.UtcNow.AddMinutes(-1);
        plans[later?1:0].Total=target;plans[later?1:0].Paid=paid;db.SaveChanges();
    });

    [Local292Theory]
    [InlineData(false,60,0,false)] [InlineData(false,40,0,true)] [InlineData(false,60,20,true)]
    [InlineData(true,60,0,false)] [InlineData(true,40,0,true)] [InlineData(true,60,20,true)]
    public async Task Due_queues_preserve_prior_investments_status_and_exact_financial_effects(bool later,int target,int paid,bool accepted)
    {
        using var h=Host();var id=await Reserve(h);if(later)await Later(h,id);Due(h,target,paid,later);
        string? original=null;h.WithDb(db=>{original=db.Properties.Find(h.PropertyId)!.Status;db.Properties.Find(h.PropertyId)!.Price=99999;db.SaveChanges();});
        await Run(h);await Run(h);
        h.WithDb(db=>{
            var a=db.InvestmentApplications.Find(id)!;
            Assert.Equal(accepted?"accepted":"rejected",a.Status);Assert.Equal(later?2:1,a.StepNumber);
            Assert.Equal(accepted?960:1000,db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(accepted?76:80,db.Properties.Find(h.PropertyId)!.AvailableShares);
            Assert.Equal(original,db.Properties.Find(h.PropertyId)!.Status);
            Assert.Equal(accepted?2:1,db.Investments.Count(x=>x.UserId==h.Actor&&x.PropertyId==h.PropertyId));
            Assert.Contains(db.Investments,x=>x.UserId==h.Actor&&x.PropertyId==h.PropertyId&&x.Shares==10&&x.InvestedAmount==100);
            Assert.Equal(accepted?paid+40:paid,db.PaymentPlans.Where(x=>x.PropertyId==h.PropertyId).OrderBy(x=>x.EventDate).ToList()[later?1:0].Paid);
            Assert.Single(db.UserTransactions.Where(x=>x.PropertyId==h.PropertyId&&x.Type==TransactionType.Investment));
            Assert.Equal(accepted?0:1,db.UserTransactions.Count(x=>x.PropertyId==h.PropertyId&&x.Type==TransactionType.InvestmentRefund&&x.PropertyId==h.PropertyId));
            Assert.Single(db.ActionLogs.Where(x=>x.Action=="InvestmentApplicationDecision3041"&&x.Details.Contains(id.ToString())));
            Assert.Single(db.Messages.Where(x=>x.RecipientId==h.Actor&&x.Content.Contains(id.ToString()+",")));
        });
        h.Login(h.Actor);var history=await h.Client.GetStringAsync($"/api/investment-workflow/applications/{id}/history");Assert.Contains("scheduler",history);
    }

    [Fact]
    public async Task Future_and_empty_stages_are_not_processed_SQLite()
    {
        using var h=Host(pg:false);var id=await Reserve(h);await Later(h,id);Due(h,1000);
        h.WithDb(db=>{db.PaymentPlans.OrderByDescending(x=>x.EventDate).First().DueDate=DateTime.UtcNow.AddDays(1);db.SaveChanges();});
        await Run(h);h.WithDb(db=>{Assert.Equal("carried",db.InvestmentApplications.Find(id)!.Status);Assert.Empty(db.ActionLogs.Where(x=>x.Action=="InvestmentApplicationDecision3041"&&x.Details.Contains(id.ToString())));});
    }

    [Local292Theory]
    [InlineData("missing")] [InlineData("duplicate")] [InlineData("settled")] [InlineData("bad-stage")]
    public async Task Unproven_queue_is_untouched_and_records_one_admin_conflict(string kind)
    {
        using var h=Host();var id=await Reserve(h);await Reserve(h,true);Due(h,20);
        h.WithDb(db=>{
            if(kind=="missing")db.ActionLogs.RemoveRange(db.ActionLogs.Where(x=>x.Action=="ApplicateForInvestment"&&x.UserId==h.Actor));
            if(kind=="duplicate"){
                var old=db.UserTransactions.Single(x=>x.UserId==h.Actor);var dup=Guid.NewGuid();
                db.UserTransactions.Add(new UserTransaction {Id=dup,UserId=h.Actor,PropertyId=h.PropertyId,Amount=40,Shares=4,Type=TransactionType.Investment});
                db.ActionLogs.Add(new ActionLog {UserId=h.Actor,Action="ApplicateForInvestment",Details=System.Text.Json.JsonSerializer.Serialize(new {sourceId=id,transactionId=dup})});
            }
            if(kind=="settled")db.InvestmentApplications.Find(id)!.ApprovedAmount=10;
            if(kind=="bad-stage")db.InvestmentApplications.Find(id)!.StepNumber=9;
            db.SaveChanges();
        });
        await Run(h,true);await Run(h,true);
        h.WithDb(db=>{Assert.All(db.InvestmentApplications.Where(x=>x.PropertyId==h.PropertyId),a=>Assert.Equal("pending",a.Status));Assert.Equal(960,db.Users.Find(h.Actor)!.WalletBalance);Assert.Equal(960,db.Users.Find(h.Other)!.WalletBalance);Assert.Single(db.ActionLogs.Where(x=>x.Action=="InvestmentSchedulerConflict3041"&&x.Details.Contains(h.PropertyId.ToString())));Assert.Empty(db.UserTransactions.Where(x=>x.Type==TransactionType.InvestmentRefund&&x.PropertyId==h.PropertyId));Assert.Equal(0,db.PaymentPlans.Single(x=>x.PropertyId==h.PropertyId).Paid);});
        h.Login(h.Actor);Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.GetAsync("/api/investment-workflow/scheduler-conflicts")).StatusCode);
        h.Login(h.Admin,role:"admin");Assert.Contains(id.ToString(),await h.Client.GetStringAsync("/api/investment-workflow/scheduler-conflicts"));
    }

    [Local292Theory]
    [InlineData(false,false)] [InlineData(false,true)] [InlineData(true,false)] [InlineData(true,true)]
    public async Task Failure_after_save_or_at_commit_rolls_back_entire_property(bool atCommit,bool accepted)
    {
        var fault=new Fault {AtCommit=atCommit};using var h=Host(fault);var id=await Reserve(h);await Reserve(h,true);Due(h,accepted?60:1000);fault.Enabled=true;
        await Assert.ThrowsAsync<InvalidOperationException>(()=>Run(h));
        h.WithDb(db=>{Assert.All(db.InvestmentApplications.Where(x=>x.PropertyId==h.PropertyId),a=>Assert.Equal("pending",a.Status));Assert.Equal(960,db.Users.Find(h.Actor)!.WalletBalance);Assert.Equal(72,db.Properties.Find(h.PropertyId)!.AvailableShares);Assert.Empty(db.ActionLogs.Where(x=>x.Action=="InvestmentApplicationDecision3041"&&x.Details.Contains(id.ToString())));Assert.Empty(db.UserTransactions.Where(x=>x.Type==TransactionType.InvestmentRefund&&x.PropertyId==h.PropertyId));Assert.Empty(db.Messages.Where(x=>x.RecipientId==h.Actor));});
        fault.Enabled=false;await Run(h);await Run(h);
        h.WithDb(db=>Assert.Equal(accepted?"accepted":"rejected",db.InvestmentApplications.Find(id)!.Status));
    }

    [Local292Theory]
    [InlineData("reject",0)] [InlineData("accept",2)] [InlineData("accept",4)] [InlineData("accept-stage",0)] [InlineData("carry",0)] [InlineData("scheduler",0)]
    public async Task Competing_admin_and_scheduler_commit_only_one_terminal_effect(string action,int shares)
    {
        var gate=new Gate();using var h=Host(gate);var id=await Reserve(h);await Later(h,id);
        // Move this fixture back into stage one after establishing the next stage.
        h.WithDb(db=>{var a=db.InvestmentApplications.Find(id)!;a.StepNumber=1;a.Status="pending";db.SaveChanges();});
        Due(h,10);h.WithDb(db=>{db.PaymentPlans.OrderByDescending(x=>x.EventDate).First().DueDate=DateTime.UtcNow.AddDays(1);db.SaveChanges();});
        h.Login(h.Admin,role:"admin");gate.Enabled=true;
        async Task<bool> Scheduler(){try{await Run(h);return true;}catch(Exception ex)when(Conflict(ex)){return false;}}
        async Task<bool> Admin(){if(action=="scheduler")return await Scheduler();var r=await Decision(h,id,action,shares);Assert.Contains(r.StatusCode,new[]{HttpStatusCode.OK,HttpStatusCode.Conflict});return r.IsSuccessStatusCode;}
        var results=await Task.WhenAll(Scheduler(),Admin());Assert.Single(results,x=>x);Assert.Single(results,x=>!x);gate.Enabled=false;
        await Run(h);
        h.WithDb(db=>{var a=db.InvestmentApplications.Find(id)!;var amount=a.ApprovedAmount??0;var approved=a.ApprovedShares??0;
            Assert.Equal(a.Status=="carried"?960:1000-amount,db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(a.Status=="carried"?76:80-approved,db.Properties.Find(h.PropertyId)!.AvailableShares);
            Assert.Single(db.UserTransactions.Where(x=>x.UserId==h.Actor&&x.Type==TransactionType.Investment));
            Assert.Equal(a.Status=="rejected"||a.Status=="partial"?1:0,db.UserTransactions.Count(x=>x.UserId==h.Actor&&x.Type==TransactionType.InvestmentRefund&&x.PropertyId==h.PropertyId));
        });
    }
    [Local292Theory]
    [InlineData(false)] [InlineData(true)]
    public async Task Multiple_due_stages_settle_together_or_roll_back_if_later_source_is_unproven(bool unproven)
    {
        using var h=Host();var carried=await Reserve(h);var first=await Reserve(h,true);await Later(h,carried);Due(h,20);
        h.WithDb(db=>{db.PaymentPlans.Where(x=>x.PropertyId==h.PropertyId).OrderByDescending(x=>x.EventDate).First().Total=1000;
            if(unproven)db.ActionLogs.RemoveRange(db.ActionLogs.Where(x=>x.Action=="ApplicateForInvestment"&&x.UserId==h.Actor));db.SaveChanges();});
        if(unproven)await Assert.ThrowsAnyAsync<InvalidOperationException>(()=>Run(h));else {await Run(h);await Run(h);}
        h.WithDb(db=>{
            Assert.Equal(unproven?"pending":"accepted",db.InvestmentApplications.Find(first)!.Status);
            Assert.Equal(unproven?"carried":"rejected",db.InvestmentApplications.Find(carried)!.Status);
            Assert.Equal(unproven?960:1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Equal(960,db.Users.Find(h.Other)!.WalletBalance);
            Assert.Equal(unproven?72:76,db.Properties.Find(h.PropertyId)!.AvailableShares);
            Assert.Equal(unproven?0:40,db.PaymentPlans.Where(x=>x.PropertyId==h.PropertyId).OrderBy(x=>x.EventDate).First().Paid);
            Assert.Equal(unproven?0:2,db.ActionLogs.Count(x=>x.Action=="InvestmentApplicationDecision3041"&&(x.Details.Contains(first.ToString())||x.Details.Contains(carried.ToString()))));
            Assert.Equal(unproven?0:1,db.UserTransactions.Count(x=>x.PropertyId==h.PropertyId&&x.Type==TransactionType.InvestmentRefund));
            Assert.Single(db.Investments.Where(x=>x.UserId==h.Actor&&x.PropertyId==h.PropertyId));
        });
    }

    [Local292Fact]
    public async Task Hosted_scheduler_startup_processes_due_queue_and_stops_cleanly()
    {
        using var h=Host();var id=await Reserve(h);Due(h,1000);
        using var service=new ScheduledTaskService(h.Services,null!);
        await service.StartAsync(CancellationToken.None);
        var settled=false;
        for(var i=0;i<100&&!settled;i++){
            h.WithDb(db=>settled=db.InvestmentApplications.Find(id)!.Status=="rejected");
            if(!settled)await Task.Delay(50);
        }
        Assert.True(settled);
        await service.StopAsync(new CancellationTokenSource(TimeSpan.FromSeconds(5)).Token);
        h.WithDb(db=>{Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Single(db.UserTransactions.Where(x=>x.UserId==h.Actor&&x.Type==TransactionType.InvestmentRefund));});
    }
    private static bool Conflict(Exception? e)=>e!=null&&(e is DbUpdateConcurrencyException||e is Npgsql.PostgresException {SqlState:"40001" or "40P01" or "23505"}||Conflict(e.InnerException));
    private sealed class Gate:SaveChangesInterceptor
    {
        public bool Enabled;private int calls;private readonly TaskCompletionSource ready=new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData d,InterceptionResult<int> r,CancellationToken ct=default){if(Enabled&&Interlocked.Increment(ref calls)<=2){if(calls==2)ready.TrySetResult();await ready.Task.WaitAsync(TimeSpan.FromSeconds(15));}return r;}
    }
    private sealed class Fault:DbTransactionInterceptor,ISaveChangesInterceptor
    {
        public bool Enabled;public bool AtCommit;
        public override ValueTask<InterceptionResult> TransactionCommittingAsync(DbTransaction t,TransactionEventData d,InterceptionResult r,CancellationToken ct=default){if(Enabled&&AtCommit)throw new InvalidOperationException("Injected commit failure");return ValueTask.FromResult(r);}
        public ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData d,int r,CancellationToken ct=default){if(Enabled&&!AtCommit)throw new InvalidOperationException("Injected post-save failure");return ValueTask.FromResult(r);}
    }
}
