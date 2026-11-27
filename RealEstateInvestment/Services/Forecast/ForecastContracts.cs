using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace RealEstateInvestment.Services.Forecast;

public sealed record ForecastRequest(
    [Range(1, int.MaxValue)] int Shares,
    [Required] GrowthScenarios Growth,
    DateOnly? AsOf,
    int[]? Horizons,
    RentAssumptions? Rent) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Growth is not null && (Growth.Negative >= 0 || Growth.Negative > Growth.Base ||
            Growth.Base > Growth.Optimistic))
            yield return new("Growth must be ordered, with a negative stress rate.", [nameof(Growth)]);

        if (Horizons is not null && (Horizons.Length is < 1 or > 10 ||
            Horizons.Any(year => year is < 1 or > 10) || Horizons.Distinct().Count() != Horizons.Length))
            yield return new("Use distinct horizons between 1 and 10 years.", [nameof(Horizons)]);

        if (AsOf?.Year > 9989)
            yield return new("AsOf must allow ten years of projection.", [nameof(AsOf)]);
    }
}

public sealed record GrowthScenarios(
    [property: JsonRequired][Range(typeof(decimal), "-100", "100")] decimal Negative,
    [property: JsonRequired][Range(typeof(decimal), "-100", "100")] decimal Base,
    [property: JsonRequired][Range(typeof(decimal), "-100", "100")] decimal Optimistic);

public sealed record RentAssumptions(
    DateOnly? StartDate,
    [Range(typeof(decimal), "0", "100")] decimal? FeePercent,
    [Range(typeof(decimal), "0", "1000000000000000")] decimal? MonthlyPropertyExpenses);

public sealed record ForecastResponse(
    int SchemaVersion, Guid PropertyId, string Currency, DateOnly AsOf, int Shares, int? TotalShares,
    decimal? RecordedPropertyPrice, decimal? OfferPricePerShare, decimal? PrimaryPurchaseCost,
    RentAssumptions? RentAssumptions, decimal? ConfiguredMonthlyPropertyRent,
    IReadOnlyList<ForecastPaymentStage> PaymentStages, IReadOnlyList<string> MissingInputs,
    IReadOnlyList<ForecastScenario> Scenarios, IReadOnlyList<ForecastCashPoint> CashFlow,
    ForecastRentalProjection RentalProjection);

public sealed record ForecastRentalProjection(
    string Kind, bool MeetsPayoutStatusAndPlanRequirements, IReadOnlyList<string> MissingInputs,
    IReadOnlyList<ForecastRentalPoint> Points);

public sealed record ForecastRentalPoint(
    int Year, DateOnly Date, int? CompleteMonths, decimal? BeforeClubFee,
    decimal? AssumedClubFee, decimal? AfterClubFee);

public sealed record ForecastPaymentStage(
    Guid Id, DateOnly? EventDate, DateOnly? DueDate, decimal? PropertyTotal, decimal? ProRataAmount);

public sealed record ForecastScenario(string Id, decimal AnnualGrowthPercent, IReadOnlyList<ForecastValuePoint> Points);

public sealed record ForecastValuePoint(
    int Year, DateOnly Date, decimal? PropertyValue, decimal? ValuePerShare, decimal? PositionValue,
    decimal? UnrealizedChangeFromRecordedValue, decimal? ChangeFromRecordedValuePercent);

public sealed record ForecastCashPoint(
    int Year, DateOnly Date, decimal? GrossRent, decimal? RentFees, decimal? OperatingExpenses,
    decimal? NetRent, decimal? ScheduledStageOutflow, decimal? NetCashAfterScheduledStages);
