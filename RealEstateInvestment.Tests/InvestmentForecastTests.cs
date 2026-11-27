using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services.Forecast;
using Xunit;

namespace RealEstateInvestment.Tests;

public sealed class InvestmentForecastTests
{
    private static readonly DateOnly AsOf = new(2026, 1, 1);
    private static readonly ForecastRequest Request = new(2, new(-10, 0, 10), AsOf, null, null);

    [Fact]
    public async Task ReturnsTypedDeterministicSeriesFromCatalogAndExplicitAssumptions()
    {
        using var host = new AssistantTestHost();
        host.Login(host.Actor);
        host.WithDb(db =>
        {
            var property = db.Properties.Single();
            property.RealPrice = 900;
            property.MonthlyRentalIncome = 100;
            db.PaymentPlans.AddRange(
                new PaymentPlan { PropertyId = property.Id, Total = 600, EventDate = new(2025, 12, 1), DueDate = new(2026, 1, 1) },
                new PaymentPlan { PropertyId = property.Id, Total = 400, EventDate = new(2026, 2, 1), DueDate = new(2027, 1, 1) });
            db.SaveChanges();
        });
        var input = Request with { Rent = new(new(2026, 7, 1), 10, 20) };
        var url = Path(host);
        var response = await host.Client.PostAsJsonAsync(url, input);
        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadAsStringAsync();
        Assert.Equal(payload, await (await host.Client.PostAsJsonAsync(url, input)).Content.ReadAsStringAsync());

        var result = (await response.Content.ReadFromJsonAsync<ForecastResponse>())!;
        Assert.Empty(result.MissingInputs);
        Assert.Equal(1, result.SchemaVersion);
        Assert.Equal("USD", result.Currency);
        Assert.Equal(10m, result.OfferPricePerShare);
        Assert.Equal(20m, result.PrimaryPurchaseCost);
        Assert.Equal(new[] { 0, 1, 3, 5 }, result.Scenarios[0].Points.Select(x => x.Year));
        Assert.Equal(16.20m, result.Scenarios[0].Points[1].PositionValue);
        Assert.Equal(-1.80m, result.Scenarios[0].Points[1].UnrealizedChangeFromRecordedValue);
        Assert.Equal(656.10m, result.Scenarios[0].Points[2].PropertyValue);
        Assert.Equal(900m, result.Scenarios[1].Points[3].PropertyValue);
        Assert.Equal(1449.46m, result.Scenarios[2].Points[3].PropertyValue);
        Assert.Equal(new DateOnly(2026, 2, 1), result.PaymentStages[1].EventDate);
        var cash = result.CashFlow[1];
        Assert.Equal(12m, cash.GrossRent);
        Assert.Equal(1.2m, cash.RentFees);
        Assert.Equal(2.4m, cash.OperatingExpenses);
        Assert.Equal(8.4m, cash.NetRent);
        Assert.Equal(8m, cash.ScheduledStageOutflow);
        Assert.Equal(.4m, cash.NetCashAfterScheduledStages);

        var rental = result.RentalProjection;
        Assert.Equal("conditional", rental.Kind);
        Assert.Empty(rental.MissingInputs);
        Assert.False(rental.MeetsPayoutStatusAndPlanRequirements);
        Assert.Equal(0m, rental.Points[0].AfterClubFee);
        Assert.Equal(6, rental.Points[1].CompleteMonths);
        Assert.Equal(12m, rental.Points[1].BeforeClubFee);
        Assert.Equal(1.2m, rental.Points[1].AssumedClubFee);
        Assert.Equal(10.8m, rental.Points[1].AfterClubFee);
    }

    [Fact]
    public async Task MissingCatalogInputsStayNullAndHorizonCanBeExtended()
    {
        using var host = new AssistantTestHost();
        host.Login(host.Actor, demo: true);
        var response = await host.Client.PostAsJsonAsync(Path(host), Request with
        {
            Growth = new(-100, -20, -5), Horizons = [10, 2]
        });
        response.EnsureSuccessStatusCode();
        var result = (await response.Content.ReadFromJsonAsync<ForecastResponse>())!;
        Assert.Equal(new[] { 0, 2, 10 }, result.Scenarios[0].Points.Select(x => x.Year));
        Assert.Null(result.Scenarios[0].Points[2].PropertyValue);
        Assert.All(result.CashFlow, cash =>
        {
            Assert.Null(cash.GrossRent);
            Assert.Null(cash.ScheduledStageOutflow);
            Assert.Null(cash.NetCashAfterScheduledStages);
        });
        Assert.Contains("rentStartDate", result.RentalProjection.MissingInputs);
        Assert.Contains("rentFeePercent", result.RentalProjection.MissingInputs);
        Assert.DoesNotContain("monthlyPropertyExpenses", result.RentalProjection.MissingInputs);
        Assert.All(result.RentalProjection.Points, point => Assert.Null(point.AfterClubFee));
        Assert.Contains("recordedPropertyPrice", result.MissingInputs);
        Assert.Contains("configuredMonthlyPropertyRent", result.MissingInputs);

        host.WithDb(db =>
        {
            db.Properties.Single().RealPrice = 5.50m;
            db.SaveChanges();
        });
        response = await host.Client.PostAsJsonAsync(Path(host), Request with { Growth = new(-100, 0, 10) });
        response.EnsureSuccessStatusCode();
        result = (await response.Content.ReadFromJsonAsync<ForecastResponse>())!;
        Assert.Equal(0m, result.Scenarios[0].Points[1].PropertyValue);
        Assert.Equal(.06m, result.Scenarios[1].Points[0].ValuePerShare);
        Assert.Equal(.11m, result.Scenarios[1].Points[0].PositionValue);
    }

    [Fact]
    public async Task RejectsInvalidRequestsAndUnavailableObjects()
    {
        using var host = new AssistantTestHost();
        var path = Path(host);
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.PostAsJsonAsync(path, Request)).StatusCode);
        host.Login(host.Actor);
        foreach (var invalid in new[]
        {
            Request with { Shares = 0 }, Request with { Shares = 101 },
            Request with { Growth = new(-101, 0, 10) }, Request with { Growth = new(-5, -10, 5) },
            Request with { Horizons = [1, 1] }, Request with { Horizons = [11] },
            Request with { AsOf = DateOnly.MaxValue }, Request with { Rent = new(AsOf, 101, 0) }
        })
            Assert.Equal(HttpStatusCode.BadRequest, (await host.Client.PostAsJsonAsync(path, invalid)).StatusCode);

        var missingGrowth = new { shares = 1, growth = new { negative = -10, optimistic = 10 } };
        Assert.Equal(HttpStatusCode.BadRequest, (await host.Client.PostAsJsonAsync(path, missingGrowth)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await host.Client.PostAsJsonAsync(path.Replace(
            host.PropertyId.ToString(), Guid.NewGuid().ToString()), Request)).StatusCode);
    }

    [Fact]
    public async Task AssistantChartUsesCatalogAndExplicitAssumptionsWithoutGemini()
    {
        using var host = new AssistantTestHost();
        var path = $"/api/assistant/investment-forecast/{host.PropertyId}";
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.PostAsJsonAsync(path, Request)).StatusCode);
        host.WithDb(db =>
        {
            var property = db.Properties.Single();
            property.RealPrice = 100000;
            property.Price = 100000;
            property.MonthlyRentalIncome = 1000;
            property.Status = "rented";
            db.PaymentPlans.Add(new PaymentPlan { PropertyId = property.Id, Total = 1000, Paid = 1000 });
            db.SaveChanges();
        });
        host.Login(host.Actor);
        var input = Request with { Growth = new(-10, 6, 10), Rent = new(AsOf, null, 500) };
        var response = await host.Client.PostAsJsonAsync(path, input);
        response.EnsureSuccessStatusCode();
        var answer = (await response.Content.ReadFromJsonAsync<RealEstateInvestment.Controllers.AssistantController.InvestmentAnswer>())!;
        Assert.Contains("Prices can fall", answer.Text);
        Assert.Equal(1000m, answer.Chart.OfferPricePerShare);
        Assert.True(answer.Chart.RentalProjection.MeetsPayoutStatusAndPlanRequirements);
        Assert.Equal(240m, answer.Chart.RentalProjection.Points[1].BeforeClubFee);
        Assert.Null(answer.Chart.RentalProjection.Points[1].AfterClubFee);
        Assert.Contains("rentFeePercent", answer.Chart.RentalProjection.MissingInputs);
        Assert.Equal(2120m, answer.Chart.Scenarios[1].Points[1].PositionValue);
        Assert.Equal(1800m, answer.Chart.Scenarios[0].Points[1].PositionValue);
    }

    [Theory]
    [InlineData(false, false, "no_data")]
    [InlineData(true, false, "historical")]
    [InlineData(true, true, "stale")]
    public async Task DubaiMarketRequiresApprovedHistoricalData(bool configured, bool stale, string status)
    {
        var through = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(stale ? -45 : -1);
        const string prefix = "Assistant:DubaiMarket:ApprovedSnapshot:";
        var values = new Dictionary<string, string?>()
        {
            [prefix + "District"] = "Fixture district",
            [prefix + "PropertyType"] = "Apartment",
            [prefix + "RegistrationType"] = "Ready",
            [prefix + "From"] = through.AddDays(-30).ToString("yyyy-MM-dd"),
            [prefix + "Through"] = through.ToString("yyyy-MM-dd"),
            [prefix + "ApprovedOn"] = through.ToString("yyyy-MM-dd"),
            [prefix + "SampleSize"] = "30",
            [prefix + "MedianAedPerSquareMetre"] = "15000"
        };
        using var host = new AssistantTestHost(services => services.AddSingleton<IConfiguration>(
            new ConfigurationBuilder().AddInMemoryCollection(configured ? values : null).Build()));
        host.Login(host.Actor);
        var answer = await host.Client.GetFromJsonAsync<RealEstateInvestment.Controllers.AssistantController.DubaiMarketAnswer>(
            "/api/assistant/dubai-market");
        Assert.NotNull(answer);
        Assert.Equal(status, answer.Status);
        Assert.Equal(configured ? 15000m : null, answer.Snapshot?.MedianAedPerSquareMetre);
    }

    private static string Path(AssistantTestHost host) => $"/api/properties/{host.PropertyId}/investment-forecast";
}
