using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Services.Forecast;

namespace RealEstateInvestment.Services.Assistant;

public sealed record AssistantForecastCard(string Property, int Horizon, bool Rental, ForecastResponse Data,
    bool Demo = false, string? Source = null, DateOnly? RatesAsOf = null, string? RateScope = null);

internal sealed record ScenarioContext(Guid? PropertyId = null, int Shares = 1, int Horizon = 5,
    bool Rental = false, DateOnly? RentalStart = null, decimal? Fee = null, GrowthScenarios? Growth = null);

internal static class ScenarioConversation
{
    private static Regex Pattern(string value) => new(value, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex Intent = Pattern(@"(?<!\p{L})(?:chart|forecast|scenario|график\w*|прогноз\w*|сценари\w*)(?!\p{L})");
    private static readonly Regex Transaction = Pattern(@"payment|deposit|withdraw|balance|portfolio|wallet|сч[её]т|баланс|портфел|плат[её]ж|заявк|вывод|пополн");
    private static readonly Regex Switch = Pattern(@"(?:^(?:and\s+)?(?:for|для)\s+\p{L}|(?:instead|вместо)\b|(?:chart|forecast|график|прогноз)\s+(?:for|для)\s+\p{L})");
    private static readonly Regex Shares = Pattern(@"(?<![\d.,-])([\d]{1,9})\s*(?:shares?\b|дол(?:я|и|ей|ю)\b)");
    private static readonly Regex Years = Pattern(@"(?<![\d.,-])([\d]{1,2})\s*(?:years?\b|лет\b|год(?:а|ов)?\b)");
    private static readonly Regex Rental = Pattern(@"rent|аренд");
    private static readonly Regex Date = Pattern(@"\b\d{4}-\d{2}-\d{2}\b");
    private static readonly Regex Fee = Pattern(@"(?:fee|комисси\w*)\s*([\d]{1,3}(?:[.,]\d+)?)\s*%");
    private static readonly Regex Rates = Pattern(@"(?:rates|ставки)\s+(-?\d+(?:[.,]\d+)?)%?\s+(-?\d+(?:[.,]\d+)?)%?\s+(-?\d+(?:[.,]\d+)?)%?");

    internal static async Task<AssistantAnswer?> ReadAsync(AppDbContext db, string input,
        AssistantLanguageSession.Conversation conversation, CancellationToken ct, bool demo = false, Guid? propertyId = null)
    {
        var active = propertyId is { } selected ? new ScenarioContext(PropertyId: selected) : conversation.Scenario;
        var initial = Intent.IsMatch(input) && !Pattern(@"payment schedule|график\w* платеж").IsMatch(input);
        if (Transaction.IsMatch(input) || (!initial && active is null)) return null;
        var shares = Shares.Match(input);
        var years = Years.Match(input);
        var rental = Rental.IsMatch(input);
        var fee = Fee.Match(input);
        var rates = Rates.Match(input);
        var properties = await db.Properties.AsNoTracking().Where(p => p.Status != "declined")
            .Select(p => new { p.Id, p.Title }).ToListAsync(ct);
        var matches = properties.Where(p => !string.IsNullOrWhiteSpace(p.Title) &&
            Regex.IsMatch(input, $@"(?<![\p{{L}}\p{{N}}]){Regex.Escape(p.Title.Trim())}(?![\p{{L}}\p{{N}}])",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)).ToArray();
        if (!initial && !shares.Success && !years.Success && !rental && !fee.Success && !rates.Success && !(active?.Rental == true && Date.IsMatch(input)) && matches.Length == 0)
            return null;

        if (!conversation.LanguageSelected && Regex.IsMatch(input, "[а-яё]", RegexOptions.IgnoreCase))
            conversation.Russian = true;
        string L(string en, string ru) => conversation.Russian ? ru : en;
        AssistantAnswer Reply(string en, string ru) => new("answered", AssistantKnowledge.Version, "investment-scenario", L(en, ru), []);
        if (matches.Length > 1)
            return Reply("Which property should I use for the chart?", "По какому объекту построить график?");

        var state = active ?? new();
        if (state.PropertyId is not null && matches.Length == 0 && Switch.IsMatch(input))
            return Reply("I could not match that property. Enter its full catalog name.", "Не удалось найти объект. Укажите полное название из каталога.");
        if (matches.Length == 1 && matches[0].Id != state.PropertyId)
            state = state with { PropertyId = matches[0].Id, RentalStart = null, Fee = null, Growth = null };
        if (shares.Success) state = state with { Shares = int.Parse(shares.Groups[1].Value, CultureInfo.InvariantCulture) };
        if (years.Success) state = state with { Horizon = int.Parse(years.Groups[1].Value, CultureInfo.InvariantCulture) };
        if (state.Shares < 1 || state.Horizon is < 1 or > 10)
            return Reply("Choose at least one share and a horizon from 1 to 10 years.", "Укажите от одной доли и горизонт от 1 до 10 лет.");
        var includeRental = rental || state.Rental;
        if (Pattern(@"without rent|без аренды").IsMatch(input)) includeRental = false;
        var date = Date.Match(input);
        if (includeRental && date.Success)
        {
            if (!DateOnly.TryParseExact(date.Value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start))
                return Reply("Enter a valid rental start date as YYYY-MM-DD.", "Укажите действительную дату начала аренды в формате ГГГГ-ММ-ДД.");
            state = state with { RentalStart = start };
        }
        if (fee.Success && Number(fee.Groups[1].Value) is { } percent)
        {
            if (percent > 100) return Reply("Choose a fee from 0% to 100%.", "Укажите комиссию от 0% до 100%.");
            state = state with { Fee = percent };
        }
        if (rates.Success)
        {
            var parsed = rates.Groups.Cast<Group>().Skip(1).Select(g => Number(g.Value)).ToArray();
            if (parsed.Any(x => x is null or < -100 or > 100) || parsed[0] >= 0 || parsed[0] > parsed[1] || parsed[1] > parsed[2])
                return Reply("Enter ordered stress, base and optimistic rates between −100% and 100%, with stress below zero.",
                    "Введите ставки от −100% до 100% в порядке стрессовая, базовая, оптимистичная. Стрессовая должна быть ниже нуля.");
            state = state with { Growth = new(parsed[0]!.Value, parsed[1]!.Value, parsed[2]!.Value) };
        }
        state = state with { Rental = includeRental };
        conversation.Scenario = state;
        conversation.Turns.Clear();
        conversation.AccountTopic = null;
        if (state.PropertyId is not { } id)
            return Reply("Enter the property name as shown in the catalog.", "Укажите название объекта как в каталоге.");
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        ForecastRateApproval? approval = null;
        string? scope = null;
        if (state.Growth is null)
        {
            approval = await ForecastRateJournal.ReadAsync(db, id, ct);
            scope = "property";
            if (!ForecastRateJournal.IsCurrent(approval, today))
            {
                approval = await ForecastRateJournal.ReadAsync(db, null, ct);
                scope = "global";
            }
            if (!ForecastRateJournal.IsCurrent(approval, today)) approval = null;
        }
        if ((state.Growth ?? approval?.Rates) is not { } growth)
            return Reply("No current approved rates are available. Enter conditional annual assumptions, for example “rates -10 0 0”.",
                "Актуальных утверждённых ставок нет. Можно ввести условные годовые ставки, например «ставки -10 0 0».")
                with { Status = "no_data" };

        var property = await db.Properties.AsNoTracking().Include(p => p.PaymentPlans)
            .SingleOrDefaultAsync(p => p.Id == id && p.Status != "declined", ct);
        if (property is null)
            return Reply("This property is unavailable. Choose another property.", "Этот объект недоступен. Выберите другой.");
        if (property.TotalShares > 0 && state.Shares > property.TotalShares)
            return Reply("The share count exceeds the property total. Enter a smaller number.", "Количество долей превышает общий объём. Укажите меньшее число.");

        var request = new ForecastRequest(state.Shares, growth, null, [.. new[] { 1, 3, 5, 10, state.Horizon }.Distinct()],
            includeRental ? new(state.RentalStart, state.Fee, null) : null);
        var data = InvestmentForecast.Calculate(property, request, today);
        return Reply("Scenario based on the saved valuation and your assumptions. Prices can fall and payouts are uncertain.",
            "Сценарий по сохранённой оценке и вашим допущениям. Стоимость может снизиться, выплаты не гарантированы.")
            with {
                Forecast = new(property.Title, state.Horizon, includeRental, data, demo,
                    approval?.Source, approval?.AsOf, approval is null ? "assumption" : scope),
                Answer = approval is null
                    ? L("Scenario based on the saved valuation and your assumptions. Prices can fall and payouts are uncertain.",
                        "Сценарий по сохранённой оценке и вашим допущениям. Стоимость может снизиться, выплаты не гарантированы.")
                    : L($"Conditional rates approved as of {approval.AsOf:yyyy-MM-dd}. Source: {approval.Source}. Prices can fall.",
                        $"Условные ставки на {approval.AsOf:yyyy-MM-dd}. Источник: {approval.Source}. Стоимость может снизиться.")
            };
    }

    private static decimal? Number(string value) => decimal.TryParse(value.Replace(',', '.'),
        NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var number) ? number : null;
}
