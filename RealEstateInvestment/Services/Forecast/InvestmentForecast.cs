using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Services.Forecast;

internal static class InvestmentForecast
{
    // Keep sourced amounts and all ten years of compounding within decimal arithmetic.
    private const decimal MaxSourceAmount = 1_000_000_000_000_000m;

    public static ForecastResponse Calculate(Property property, ForecastRequest request, DateOnly asOf)
    {
        int? totalShares = property.TotalShares > 0 ? property.TotalShares : null;
        decimal? fraction = (decimal)request.Shares / totalShares;
        var recordedPrice = PositiveAmount(property.RealPrice);
        var offerPerShare = PositiveAmount(property.Price) / totalShares;
        var monthlyRent = PositiveAmount(property.MonthlyRentalIncome);
        var rent = request.Rent;
        var stages = InvestmentStages.Ordered(property.PaymentPlans).Select(stage =>
        {
            var amount = stage.Total is > 0 and <= MaxSourceAmount ? stage.Total : (decimal?)null;
            return new ForecastPaymentStage(stage.Id, Day(stage.EventDate), Day(stage.DueDate), amount,
                Money(amount * fraction));
        }).ToArray();

        var missing = new List<string>();
        if (recordedPrice is null) missing.Add("recordedPropertyPrice");
        if (offerPerShare is null) missing.Add("offerPricePerShare");
        if (totalShares is null) missing.Add("totalShares");
        if (monthlyRent is null) missing.Add("configuredMonthlyPropertyRent");
        if (rent?.StartDate is null) missing.Add("rentStartDate");
        if (rent?.FeePercent is null) missing.Add("rentFeePercent");
        if (rent?.MonthlyPropertyExpenses is null) missing.Add("monthlyPropertyExpenses");
        bool hasCompleteStages = stages.Length > 0 && stages.All(stage => stage.DueDate.HasValue && stage.ProRataAmount.HasValue);
        if (!hasCompleteStages) missing.Add("completePaymentStages");

        var years = new[] { 0 }.Concat((request.Horizons ?? [1, 3, 5]).Order()).ToArray();
        var scenarios = new[]
        {
            Scenario("negative", request.Growth.Negative),
            Scenario("base", request.Growth.Base),
            Scenario("optimistic", request.Growth.Optimistic)
        };
        var cashFlow = years.Select(CashPoint).ToArray();
        // This is a scenario for the requested share count, not a payment or an account entitlement.
        string[] rentalKeys = ["totalShares", "configuredMonthlyPropertyRent", "rentStartDate", "rentFeePercent"];
        var plans = property.PaymentPlans;
        var meetsPayoutRequirements = property.Status == "rented" && plans is not null &&
            plans.Any(plan => plan.Total > 0) && plans.All(plan => plan.Total >= 0 && plan.Paid >= plan.Total);
        var rentalProjection = new ForecastRentalProjection("conditional", meetsPayoutRequirements,
            missing.Where(rentalKeys.Contains).ToArray(), years.Select(RentalPoint).ToArray());
        return new(1, property.Id, "USD", asOf, request.Shares, totalShares, recordedPrice,
            Money(offerPerShare), Money(offerPerShare * request.Shares), rent, monthlyRent, stages, missing, scenarios, cashFlow, rentalProjection);

        ForecastScenario Scenario(string id, decimal annualGrowth)
        {
            var points = new List<ForecastValuePoint>();
            var value = recordedPrice;
            int previousYear = 0;
            foreach (var year in years)
            {
                for (int i = previousYear; i < year; i++)
                    value *= 1 + annualGrowth / 100m;
                points.Add(new(year, asOf.AddYears(year), Money(value), Money(value / totalShares),
                    Money(value * fraction), Money((value - recordedPrice) * fraction),
                    recordedPrice is { } baseline && fraction.HasValue ? Money((value - baseline) / baseline * 100) : null));
                previousYear = year;
            }
            return new(id, annualGrowth, points);
        }

        ForecastRentalPoint RentalPoint(int year)
        {
            var end = asOf.AddYears(year);
            var months = RentalMonths(end);
            var monthlyDistribution = Money(monthlyRent * fraction);
            var beforeFee = OverMonths(monthlyDistribution, months);
            var fee = OverMonths(Money(monthlyDistribution * rent?.FeePercent / 100m), months);
            return new(year, end, months, beforeFee, fee, beforeFee - fee);
        }

        int? RentalMonths(DateOnly end) =>
            rent?.StartDate is { } start ? CompleteMonths(start > asOf ? start : asOf, end) : null;

        ForecastCashPoint CashPoint(int year)
        {
            var end = asOf.AddYears(year);
            var months = RentalMonths(end);
            var grossPerMonth = monthlyRent * fraction;
            var feePerMonth = Money(grossPerMonth * rent?.FeePercent / 100m);
            var expensesPerMonth = Money(rent?.MonthlyPropertyExpenses * fraction);
            var gross = OverMonths(Money(grossPerMonth), months);
            var fees = OverMonths(feePerMonth, months);
            var expenses = OverMonths(expensesPerMonth, months);
            var net = gross - fees - expenses;
            decimal? stageOutflow = hasCompleteStages
                ? stages.Where(stage => stage.DueDate > asOf && stage.DueDate <= end).Sum(stage => stage.ProRataAmount)
                : null;
            return new(year, end, gross, fees, expenses, net, stageOutflow, net - stageOutflow);
        }
    }

    private static int CompleteMonths(DateOnly start, DateOnly end)
    {
        if (end <= start) return 0;
        int months = (end.Year - start.Year) * 12 + end.Month - start.Month;
        return start.AddMonths(months) > end ? months - 1 : months;
    }

    private static decimal? OverMonths(decimal? monthly, int? months) => months == 0 ? 0m : monthly * months;
    private static decimal? PositiveAmount(decimal? amount) => amount is > 0 and <= MaxSourceAmount ? amount : null;
    private static decimal? Money(decimal? amount) => amount is { } value ? Math.Round(value, 2, MidpointRounding.ToEven) : null;
    private static DateOnly? Day(DateTime? value) => value is { } date && date != default ? DateOnly.FromDateTime(date) : null;
}
