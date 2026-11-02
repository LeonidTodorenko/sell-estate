using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace RealEstateInvestment.Tests;
[Collection("Ledger292Postgres")]
public sealed class DemoInvestmentPostgres300Tests
{
    private static FinancialTestHost Host(IInterceptor gate) => new(interceptor:gate,
        isolatedPostgres:Environment.GetEnvironmentVariable("QA292_DB")!);
    private static Task<HttpResponseMessage> Buy(FinancialTestHost h,Guid id,int shares=2)
    {
        var request=new HttpRequestMessage(HttpMethod.Post,"/api/investments/apply");
        request.Headers.Add("Idempotency-Key",id.ToString());
        request.Content=JsonContent.Create(new {propertyId=h.PropertyId,requestedShares=shares,pinOrPassword="4444"});
        return h.Client.SendAsync(request);
    }
    [Local292Theory]
    [InlineData(true)] [InlineData(false)]
    public async Task Concurrent_requests_commit_one_debit_and_retry_original_key_succeeds(bool sameKey)
    {
        var gate=new SaveGate();using var h=Host(gate);h.Login(h.Demo,demo:true);var id=Guid.NewGuid();gate.Enabled=true;
        var results=await Task.WhenAll(Buy(h,id,sameKey?2:70),Buy(h,sameKey?id:Guid.NewGuid(),sameKey?2:70));
        Assert.Single(results,r=>r.StatusCode==HttpStatusCode.OK);
        Assert.Single(results,r=>r.StatusCode==HttpStatusCode.Conflict);
        h.WithDb(db=>{
            Assert.Equal(sameKey?980:300,db.DemoUsers.Find(h.Demo)!.WalletBalance);
            Assert.Single(db.DemoUserTransactions.Where(x=>x.DemoUserId==h.Demo));
            Assert.Single(db.DemoActionLogs.Where(x=>x.DemoUserId==h.Demo));
        });
        if(sameKey)Assert.Equal(HttpStatusCode.OK,(await Buy(h,id)).StatusCode);
    }
    [Local292Fact]
    public async Task Failure_after_save_rolls_back_wallet_allocation_journal_and_audit()
    {
        var fault=new Failure();using var h=Host(fault);h.Login(h.Demo,demo:true);fault.Enabled=true;var id=Guid.NewGuid();
        await Assert.ThrowsAsync<InvalidOperationException>(()=>Buy(h,id));
        h.WithDb(db=>{
            Assert.Equal(1000,db.DemoUsers.Find(h.Demo)!.WalletBalance);
            Assert.Empty(db.DemoUserTransactions.Where(x=>x.DemoUserId==h.Demo));
            Assert.Empty(db.DemoActionLogs.Where(x=>x.DemoUserId==h.Demo));
            Assert.Empty(db.DemoInvestmentApplications.Where(x=>x.DemoUserId==h.Demo));
        });
        fault.Enabled=false;Assert.Equal(HttpStatusCode.OK,(await Buy(h,id)).StatusCode);
    }
    private sealed class SaveGate:SaveChangesInterceptor
    {
        public bool Enabled;private int calls;
        private readonly TaskCompletionSource gate=new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData data,InterceptionResult<int> result,CancellationToken token=default)
        {
            if(Enabled && Interlocked.Increment(ref calls)<=2){if(calls==2)gate.TrySetResult();await gate.Task.WaitAsync(TimeSpan.FromSeconds(15));}
            return result;
        }
    }
    private sealed class Failure:SaveChangesInterceptor
    {
        public bool Enabled;
        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData data,int result,CancellationToken token=default)
        {if(Enabled)throw new InvalidOperationException("Injected rollback test");return ValueTask.FromResult(result);}
    }
}
