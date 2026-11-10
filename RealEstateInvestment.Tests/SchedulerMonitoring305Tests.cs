using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RealEstateInvestment.Services;
using Xunit;

namespace RealEstateInvestment.Tests;

public sealed class SchedulerMonitoring305Tests
{
    private static Task Tick(FinancialTestHost host) => (Task)typeof(ScheduledTaskService)
        .GetMethod("RunTick", BindingFlags.Instance | BindingFlags.NonPublic)!
        .Invoke(new ScheduledTaskService(host.Services, null!), null)!;

    [Fact]
    public async Task Run_history_is_admin_only_bounded_and_read_only()
    {
        using var h = new FinancialTestHost();
        h.WithDb(db => {
            for (var i = 0; i < 205; i++) db.ActionLogs.Add(new() { UserId = Guid.Empty,
                Action = "SchedulerRun305", Details = "{}", Timestamp = DateTime.UtcNow.AddSeconds(i) });
            db.ActionLogs.Add(new() { UserId = Guid.Empty, Action = "InvestmentSchedulerConflict3041", Details = "{}" });
            db.SaveChanges();
        });
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync("/api/investment-workflow/scheduler-runs")).StatusCode);
        h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync("/api/investment-workflow/scheduler-runs")).StatusCode);
        h.Login(h.Admin, role: "admin");
        var response = await h.Client.GetAsync("/api/investment-workflow/scheduler-runs");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var rows = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement[]>();
        Assert.Equal(200, rows!.Length);
        Assert.True(rows[0].GetProperty("timestamp").GetDateTime() >= rows[^1].GetProperty("timestamp").GetDateTime());
        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await h.Client.PostAsJsonAsync("/api/investment-workflow/scheduler-runs", new {})).StatusCode);
        h.WithDb(db => Assert.Equal(206, db.ActionLogs.Count(x => x.Action == "SchedulerRun305" || x.Action == "InvestmentSchedulerConflict3041")));
    }

    [Fact]
    public async Task Tick_failure_is_durable_redacted_and_correlated_with_start()
    {
        var fault = new DiscoveryFailure();
        using var h = new FinancialTestHost(interceptor: fault);
        fault.Armed = true;
        await Tick(h);
        h.WithDb(db => {
            var rows = db.ActionLogs.Where(x => x.Action == "SchedulerRun305").OrderBy(x => x.Timestamp).ToArray();
            Assert.Equal(2, rows.Length);
            var start = System.Text.Json.JsonDocument.Parse(rows[0].Details).RootElement;
            var end = System.Text.Json.JsonDocument.Parse(rows[1].Details).RootElement;
            Assert.Equal("started", start.GetProperty("status").GetString());
            Assert.Equal("failed", end.GetProperty("status").GetString());
            Assert.Equal(start.GetProperty("runId").GetGuid(), end.GetProperty("runId").GetGuid());
            Assert.DoesNotContain("PRIVATE-CONNECTION", rows[1].Details);
            Assert.Equal("InvalidOperationException", end.GetProperty("errorType").GetString());
        });
        fault.Armed = false;
        await Tick(h);
        h.WithDb(db => Assert.True(db.ActionLogs.Count(x => x.Action == "SchedulerRun305") >= 4));
    }

    [Fact]
    public async Task Swallowed_property_failure_marks_tick_completed_with_issues()
    {
        var fault = new DiscoveryFailure { RoundOnly = true };
        using var h = new FinancialTestHost(interceptor: fault);
        fault.Armed = true;
        await Tick(h);
        h.WithDb(db => {
            var rows = db.ActionLogs.Where(x => x.Action == "SchedulerRun305").ToArray();
            Assert.Contains(rows, x => x.Details.Contains("stage_failed"));
            Assert.Contains(rows, x => x.Details.Contains("completed_with_issues"));
            Assert.DoesNotContain(rows, x => x.Details.Contains("PRIVATE-CONNECTION"));
        });
    }

    private sealed class DiscoveryFailure : DbCommandInterceptor
    {
        public bool Armed;
        public bool RoundOnly;
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (Armed && command.CommandText.Contains("FROM \"Properties\"") && (!RoundOnly || command.CommandText.Contains("JOIN \"PaymentPlans\""))) throw new InvalidOperationException("PRIVATE-CONNECTION");
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }
}
