using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using RealEstateInvestment.Models;
using Xunit;

namespace RealEstateInvestment.Tests;

public class MonthlyReportsLocalizationTests
{
    [Fact]
    public async Task English_interface_reports_ignore_Russian_device_language()
    {
        using var h = new FinancialTestHost(services => services.AddMemoryCache());
        var date = new DateTime(2026, 11, 28, 12, 0, 0, DateTimeKind.Utc);
        h.WithDb(db => {
            db.InvestorMonthlyReports.Add(new InvestorMonthlyReport {
                UserId = h.Actor, ReportMonth = new DateTime(2026,11,1,0,0,0,DateTimeKind.Utc),
                GeneratedAt = date, WalletBalance = 1200.50m, InvestmentValue = 200m,
                TotalCapital = 1400.50m
            });
            db.DemoMonthlyReports.Add(new DemoMonthlyReport {
                DemoUserId = h.Demo, ReportMonth = date, WalletBalance = 1200.50m,
                InvestmentValue = 200m, TotalCapital = 1400.50m, GeneratedAt = date
            });
            db.SaveChanges();
        });
        h.Client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("ru-RU,ru;q=0.9");
        foreach (var demo in new[] {false, true})
        {
            h.Login(demo ? h.Demo : h.Actor, demo);
            var rows = await h.Client.GetFromJsonAsync<System.Text.Json.JsonElement[]>(
                demo ? "/api/demo/monthly-reports" : "/api/monthly-reports");
            var row = Assert.Single(rows!);
            Assert.DoesNotMatch("[А-Яа-яЁё]", row.GetProperty("commentary").GetString()!);
            Assert.Equal(1200.50m, row.GetProperty("walletBalance").GetDecimal());
            Assert.Equal(date, row.GetProperty("reportMonth").GetDateTime());
        }
    }
}
