using System.Net;
using System.Text.Json;
using System.Net.Http.Json;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services.Assistant;
using Xunit;

namespace RealEstateInvestment.Tests;

public sealed class AssistantInvestmentIntelligenceTests
{
    [Fact]
    public async Task ChatKeepsScenarioAcrossTurnsAndIsolatesAccounts()
    {
        using var host = new AssistantTestHost();
        var second = Seed(host);
        host.Login(host.Actor);
        var first = await Ask(host, "Show a forecast for Marina Residence, 2 shares, 3 years, rates -10 6 10");
        Assert.NotNull(first.Forecast);
        Assert.Equal(2, first.Forecast.Data.Shares);
        Assert.Equal(3, first.Forecast.Horizon);
        Assert.Equal(2120m, first.Forecast.Data.Scenarios[1].Points[1].PositionValue);
        var follow = await Ask(host, "Make it 4 shares for 7 years with rent from 2027-01-01 and fee 10%", first.ConversationId);
        Assert.Equal(4, follow.Forecast!.Data.Shares);
        Assert.Equal(7, follow.Forecast.Horizon);
        Assert.True(follow.Forecast.Rental);
        Assert.Equal(new DateOnly(2027, 1, 1), follow.Forecast.Data.RentAssumptions?.StartDate);
        var russian = await Ask(host, "Покажи прогноз на 4 доли и 7 лет", first.ConversationId);
        Assert.Equal(7, russian.Forecast!.Horizon);
        Assert.Equal(4, russian.Forecast.Data.Shares);
        Assert.Contains(russian.Forecast.Data.CashFlow, point => point.Year == 7);
        var changed = await Ask(host, "And for Creek Residence instead", first.ConversationId);
        Assert.Equal("no_data", changed.Status);
        changed = await Ask(host, "rates -10 6 10", first.ConversationId);
        Assert.Equal(second, changed.Forecast!.Data.PropertyId);
        Assert.Equal(4, changed.Forecast.Data.Shares);
        Assert.Null(changed.Forecast.Data.RentAssumptions?.StartDate);
        host.Login(host.Other);
        var foreign = await Ask(host, "Make it 5 shares", first.ConversationId);
        Assert.NotEqual(first.ConversationId, foreign.ConversationId);
        Assert.Null(foreign.Forecast);
    }

    [Fact]
    public async Task ApprovalsAreAdminOnlyAndRecommendationsUseOwnerBalanceAndHoldings()
    {
        using var host = new AssistantTestHost();
        var second = Seed(host);
        var approval = new ForecastRateApproval(new(-10, 0, 1), "Committee assumptions", DateOnly.FromDateTime(DateTime.UtcNow));
        host.Login(host.Actor, role: "admin");
        Assert.Equal(HttpStatusCode.Forbidden, (await host.Client.PutAsJsonAsync("/api/admin/forecast-rates", approval)).StatusCode);
        host.Login(host.Admin, role: "admin");
        Assert.Equal(HttpStatusCode.NoContent, (await host.Client.PutAsJsonAsync("/api/admin/forecast-rates", approval)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await host.Client.PutAsJsonAsync($"/api/admin/forecast-rates?propertyId={second}",
            approval with { Rates = new(-12, 1, 3), Source = "Property committee" })).StatusCode);
        host.Login(host.Actor);
        var forecast = await Ask(host, "Forecast for Creek Residence");
        Assert.NotNull(forecast.Forecast);
        Assert.Equal(-12m, forecast.Forecast.Data.Scenarios[0].AnnualGrowthPercent);
        Assert.Contains("Property committee", forecast.Answer);
        var compare = await Ask(host, "Compare Marina Residence and Creek Residence");
        Assert.Contains("Marina Residence", compare.Answer);
        Assert.Contains("Creek Residence", compare.Answer);
        var list = await Ask(host, "Recommend properties with budget 2000");
        Assert.Contains("1000.00 USD", list.Answer);
        Assert.Contains("Creek Residence", list.Answer);
        Assert.True(list.Answer.IndexOf("Creek Residence", StringComparison.Ordinal) < list.Answer.IndexOf("Marina Residence", StringComparison.Ordinal));
        Assert.Contains("Already held", list.Answer);
        var market = await Ask(host, "Dubai market");
        Assert.Equal("dubai-market", market.Topic);
        Assert.Contains("unavailable", market.Answer);
    }

    [Fact]
    public async Task InsightsReadOnlyAndScopedToCurrentActor()
    {
        using var host = new AssistantTestHost();
        var property = Seed(host);
        host.Login(host.Actor);
        var noRates = await host.Client.GetFromJsonAsync<AssistantAnswer>($"/api/assistant/property-insights/{property}");
        Assert.Equal("no_data", noRates!.Status);
        Assert.Null(noRates.Forecast);
        var actor = await host.Client.GetFromJsonAsync<JsonElement>("/api/assistant/portfolio-insights");
        Assert.Equal(1, actor.GetProperty("propertyCount").GetInt32());
        Assert.Equal(100m, actor.GetProperty("concentration").GetDecimal());
        host.Login(host.Other);
        var other = await host.Client.GetFromJsonAsync<JsonElement>("/api/assistant/portfolio-insights");
        Assert.Equal(0, other.GetProperty("propertyCount").GetInt32());
        Assert.Equal(JsonValueKind.Null, other.GetProperty("concentration").ValueKind);
        host.Login(host.Demo, demo: true);
        var demo = await host.Client.GetFromJsonAsync<JsonElement>("/api/assistant/portfolio-insights");
        Assert.True(demo.GetProperty("demo").GetBoolean());
        Assert.Equal(1, demo.GetProperty("propertyCount").GetInt32());
    }

    private static Guid Seed(AssistantTestHost host)
    {
        var id = Guid.NewGuid();
        host.WithDb(db =>
        {
            var first = db.Properties.Single();
            first.Title = "Marina Residence";
            first.Price = 100000;
            first.RealPrice = 100000;
            first.MonthlyRentalIncome = 1000;
            first.Status = "available";
            first.AvailableShares = 8;
            db.Properties.Add(new Property
            {
                Id = id, Title = "Creek Residence", Location = "Fixture", TotalShares = 100,
                Status = "available", Price = 90000, RealPrice = 80000, AvailableShares = 20
            });
            db.Users.Single(user => user.Id == host.Admin).Role = "admin";
            db.SaveChanges();
        });
        return id;
    }

    private static async Task<AssistantAnswer> Ask(AssistantTestHost host, string text, Guid? conversationId = null)
    {
        using var response = await host.Client.PostAsJsonAsync("/api/assistant/ask", new { text, conversationId, allowExternal = false });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AssistantAnswer>())!;
    }
}
