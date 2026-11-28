using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Models;
using RealEstateInvestment.Data;
using RealEstateInvestment.Services;
using Xunit;

namespace RealEstateInvestment.Tests;

[Collection("RestoredPostgres")]
public class MonthlyReports3093Tests
{
    [Local262BFact]
    public async Task Capture_is_idempotent_owned_and_preserves_financial_state()
    {
        using var h = new FinancialTestHost(isolatedPostgres: Environment.GetEnvironmentVariable("QA262B_DB")!);
        decimal wallet = 0;
        int transactions = 0;
        h.WithDb(db => {
            wallet = db.Users.Find(h.Actor)!.WalletBalance;
            transactions = db.UserTransactions.Count();
        });
        async Task Capture()
        {
            using var scope = h.Services.CreateScope();
            await new InvestorMonthlySnapshotService(scope.ServiceProvider.GetRequiredService<AppDbContext>()).CaptureAsync(h.Actor);
        }
        await Task.WhenAll(Capture(), Capture());
        await Capture();
        h.WithDb(db => {
            var report = Assert.Single(db.InvestorMonthlyReports.Where(x => x.UserId == h.Actor));
            Assert.Equal(wallet, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(transactions, db.UserTransactions.Count());
            Assert.Equal(report.WalletBalance + report.InvestmentValue, report.TotalCapital);
            Assert.Equal(0, report.CapitalChange);
            Assert.True(report.GeneratedAt > DateTime.UtcNow.AddMinutes(-2));
        });
        h.Login(null);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync("/api/monthly-reports")).StatusCode);
        h.Login(h.Demo, demo: true);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync("/api/monthly-reports")).StatusCode);
        h.Login(h.Other);
        Assert.Empty((await h.Client.GetFromJsonAsync<InvestorMonthlyReport[]>("/api/monthly-reports"))!);
        h.Login(h.Actor);
        Assert.Single((await h.Client.GetFromJsonAsync<InvestorMonthlyReport[]>("/api/monthly-reports?userId=" + h.Other))!);
    }
}
