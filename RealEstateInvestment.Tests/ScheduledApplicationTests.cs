using System.Reflection;
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using Xunit;

namespace RealEstateInvestment.Tests;

public class ScheduledApplicationTests
{
    private static Task Tick(FinancialTestHost h) => (Task)typeof(ScheduledTaskService)
        .GetMethod("RunScheduledProperyStatusTask", BindingFlags.Instance | BindingFlags.NonPublic)!
        .Invoke(new ScheduledTaskService(h.Services, null!), null)!;

    private static void Seed(FinancialTestHost h, decimal total, bool history = false)
    {
        h.WithDb(db =>
        {
            db.Investments.RemoveRange(db.Investments);
            var step = db.PaymentPlans.Single();
            step.Total = 100000; step.DueDate = DateTime.UtcNow.AddDays(-1);
            var property = db.Properties.Find(h.PropertyId)!;
            property.AvailableShares = 50; property.PriorityInvestorId = h.Actor;
            foreach (var user in new[] { h.Actor, h.Other })
                db.InvestmentApplications.Add(new InvestmentApplication
                {
                    UserId = user, PropertyId = h.PropertyId, RequestedAmount = total / 2,
                    RequestedShares = 25, IsPriority = user == h.Actor
                });
            if (history)
                foreach (var status in new[] { "accepted", "rejected", "partial", "carried" })
                    db.InvestmentApplications.Add(new InvestmentApplication
                    {
                        UserId = h.Actor, PropertyId = h.PropertyId, Status = status,
                        RequestedAmount = 200000, RequestedShares = 20,
                        ApprovedAmount = 123, ApprovedShares = 3, StepNumber = 2
                    });
            db.SaveChanges();
        });
    }

    [Theory]
    [InlineData(70000, false)]
    [InlineData(100000, false)]
    [InlineData(150000, false)]
    [InlineData(70000, true)]
    [InlineData(100000, true)]
    [InlineData(150000, true)]
    public async Task Threshold_and_repeat_ticks_preserve_reservations_and_ignore_history(int total, bool history)
    {
        using var h = new FinancialTestHost();
        Seed(h, total, history);
        for (var tick = 0; tick < 2; tick++)
        {
            await Tick(h);
            h.WithDb(db =>
            {
                bool accepted = total >= 100000;
                var apps = db.InvestmentApplications.Where(a => a.StepNumber == 1).ToList();
                Assert.Equal(2, apps.Count);
                Assert.All(apps, a =>
                {
                    Assert.Equal(accepted ? "accepted" : "rejected", a.Status);
                    Assert.Equal(accepted ? a.RequestedAmount : (decimal?)null, a.ApprovedAmount);
                    Assert.Equal(accepted ? a.RequestedShares : (int?)null, a.ApprovedShares);
                });
                Assert.Equal(accepted ? total : 0, db.PaymentPlans.Single().Paid);
                Assert.Equal(accepted ? 2 : 0, db.Investments.Count());
                Assert.Equal(accepted ? total : 0, db.Investments.AsEnumerable().Sum(i => i.InvestedAmount));
                foreach (var user in new[] { h.Actor, h.Other })
                    Assert.Equal(accepted ? 1000 : 1000 + total / 2, db.Users.Find(user)!.WalletBalance);
                var property = db.Properties.Find(h.PropertyId)!;
                Assert.Equal(accepted ? 50 : 100, property.AvailableShares);
                if (!accepted) { Assert.Equal(tick == 0 ? "declined" : "active", property.Status); Assert.Null(property.PriorityInvestorId); }
                else Assert.Equal(h.Actor, property.PriorityInvestorId);
                Assert.Equal(2, db.Messages.Count()); Assert.Single(db.ActionLogs.Where(a => a.Action.StartsWith("InvestmentStep")));
                if (history)
                {
                    var old = db.InvestmentApplications.Where(a => a.StepNumber == 2).ToList();
                    Assert.Equal(new[] { "accepted", "carried", "partial", "rejected" }, old.Select(a => a.Status).OrderBy(s => s));
                    Assert.All(old, a => { Assert.Equal(123, a.ApprovedAmount); Assert.Equal(3, a.ApprovedShares); });
                }
            });
            // Remove outer guards to prove the pending filter itself prevents replay.
            if (tick == 0) h.WithDb(db =>
            {
                db.Properties.Find(h.PropertyId)!.Status = "active";
                db.SaveChanges();
            });
        }
    }

    [Theory]
    [InlineData("empty")]
    [InlineData("future")]
    [InlineData("later")]
    [InlineData("null-later")]
    public async Task Ineligible_rounds_do_nothing(string scenario)
    {
        using var h = new FinancialTestHost(); Seed(h, 150000);
        h.WithDb(db =>
        {
            var step = db.PaymentPlans.Single();
            if (scenario == "empty") db.InvestmentApplications.RemoveRange(db.InvestmentApplications);
            if (scenario == "future") step.DueDate = DateTime.UtcNow.AddDays(1);
            if (scenario is "later" or "null-later")
            {
                step.Paid = 100000;
                if (scenario == "null-later") step.EventDate = null;
                db.PaymentPlans.Add(new PaymentPlan { PropertyId = h.PropertyId,
                    EventDate = scenario == "null-later" ? null : DateTime.UtcNow,
                    DueDate = DateTime.UtcNow.AddHours(-1), Total = 100000 });
            }
            db.SaveChanges();
        });
        await Tick(h);
        h.WithDb(db =>
        {
            Assert.Empty(db.Investments); Assert.Empty(db.Messages); Assert.Empty(db.ActionLogs);
            Assert.Equal(1000, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(50, db.Properties.Find(h.PropertyId)!.AvailableShares);
            Assert.All(db.InvestmentApplications, a => Assert.Equal("pending", a.Status));
        });
    }

    [Fact]
    public async Task Null_first_event_date_is_processed()
    {
        using var h = new FinancialTestHost(); Seed(h, 100000);
        h.WithDb(db => { db.PaymentPlans.Single().EventDate = null; db.SaveChanges(); });
        await Tick(h);
        h.WithDb(db => Assert.Equal(100000, db.PaymentPlans.Single().Paid));
    }

    [Fact]
    public async Task Firebase_observes_committed_state_and_failure_does_not_repeat_financial_work()
    {
        var stub = new NotificationStub();
        using var h = new FinancialTestHost(s => s.AddSingleton<IFirebaseNotificationService>(stub));
        Seed(h, 150000);
        h.WithDb(db => { db.FcmDeviceTokens.Add(new FcmDeviceToken { UserId = h.Actor, Token = "isolated" }); db.SaveChanges(); });
        var observedCommit = false;
        stub.OnSend = () => h.WithDb(db =>
        {
            Assert.Null(db.Database.CurrentTransaction);
            Assert.Equal(150000, db.PaymentPlans.Single().Paid);
            Assert.Equal(2, db.Investments.Count()); Assert.Equal(2, db.Messages.Count());
            observedCommit = true;
        });
        await Tick(h); await Tick(h);
        Assert.Equal(1, stub.Calls);
        Assert.True(observedCommit);
        h.WithDb(db =>
        {
            Assert.Equal(2, db.Investments.Count());
            Assert.Single(db.ActionLogs.Where(a => a.Action == "FirebaseNotificationService send error"));
        });
    }

    [Theory]
    [InlineData("40001", 150000)]
    [InlineData("40P01", 150000)]
    [InlineData("40001", 70000)]
    public async Task Commit_conflict_rolls_back_whole_round_and_next_tick_can_process(string sqlState, int total)
    {
        var fault = new CommitFault(sqlState);
        var stub = new NotificationStub();
        using var h = new FinancialTestHost(s => s.AddSingleton<IFirebaseNotificationService>(stub), fault);
        Seed(h, total);
        h.WithDb(db => { db.FcmDeviceTokens.Add(new FcmDeviceToken { UserId = h.Actor, Token = "isolated" }); db.SaveChanges(); });
        fault.Enabled = true;
        await Tick(h);
        Assert.Equal(1, fault.Calls); Assert.Equal(0, stub.Calls);
        h.WithDb(db =>
        {
            Assert.Empty(db.Investments); Assert.Empty(db.Messages); Assert.Empty(db.ActionLogs);
            Assert.All(db.InvestmentApplications, a => Assert.Equal("pending", a.Status));
            Assert.Equal(0, db.PaymentPlans.Single().Paid);
            Assert.Equal(1000, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(1000, db.Users.Find(h.Other)!.WalletBalance);
            Assert.Equal(50, db.Properties.Find(h.PropertyId)!.AvailableShares);
            Assert.Equal(h.Actor, db.Properties.Find(h.PropertyId)!.PriorityInvestorId);
        });
        fault.Enabled = false;
        await Tick(h); await Tick(h);
        h.WithDb(db =>
        {
            Assert.Equal(total >= 100000 ? 2 : 0, db.Investments.Count());
            Assert.Equal(total >= 100000 ? 1000 : 36000, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(2, db.Messages.Count());
        });
    }

    private sealed class CommitFault(string sqlState) : DbTransactionInterceptor
    {
        public bool Enabled { get; set; }
        public int Calls { get; private set; }
        public override ValueTask<InterceptionResult> TransactionCommittingAsync(DbTransaction transaction,
            TransactionEventData eventData, InterceptionResult result, CancellationToken cancellationToken = default)
        {
            Assert.Equal(System.Data.IsolationLevel.Serializable, transaction.IsolationLevel);
            if (Enabled)
            {
                Calls++;
                throw new DbUpdateException("Injected commit conflict", new Npgsql.PostgresException("isolated", "ERROR", "ERROR", sqlState));
            }
            return ValueTask.FromResult(result);
        }
    }

    private sealed class NotificationStub : IFirebaseNotificationService
    {
        public Action OnSend { get; set; } = () => { };
        public int Calls { get; private set; }
        public Task SendNotificationAsync(string token, string title, string body)
        {
            Calls++; OnSend(); throw new InvalidOperationException("Isolated Firebase failure");
        }
    }
}
