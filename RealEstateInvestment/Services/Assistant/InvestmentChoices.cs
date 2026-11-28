using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using System.Security.Claims;

namespace RealEstateInvestment.Services.Assistant;

internal static class InvestmentChoices
{
    private static readonly Regex Compare = new(@"^\s*(?:compare|сравни(?:те)?)\b", RegexOptions.IgnoreCase);
    private static readonly Regex Recommend = new(@"^\s*(?:recommend|подбери(?:те)?|порекомендуй(?:те)?)\b", RegexOptions.IgnoreCase);

    internal static async Task<AssistantAnswer?> ReadAsync(AppDbContext db, ClaimsPrincipal user, string input,
        AssistantLanguageSession.Conversation conversation, CancellationToken ct)
    {
        bool compare = Compare.IsMatch(input);
        if (!compare && !Recommend.IsMatch(input)) return null;
        if (!conversation.LanguageSelected) conversation.Russian = Regex.IsMatch(input, "[а-яё]", RegexOptions.IgnoreCase);
        string L(string en, string ru) => conversation.Russian ? ru : en;
        AssistantAnswer Reply(string value) => new("answered", AssistantKnowledge.Version,
            compare ? "investment-comparison" : "investment-recommendation", value, []);
        conversation.Turns.Clear();
        conversation.AccountTopic = null;
        var properties = await db.Properties.ExcludeTechnicalFixtures().AsNoTracking().Where(p => p.Status != "declined")
            .Select(p => new { p.Id, p.Title, p.Price, p.RealPrice, p.TotalShares, p.AvailableShares, p.Status }).ToListAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var global = await ForecastRateJournal.ReadAsync(db, null, ct);
        if (compare)
        {
            var matches = AssistantPropertyNames.Match(input, properties, p => p.Title);
            if (matches.Length != 2) return Reply(L("Name two distinct properties exactly as shown in the catalog.",
                "Укажите названия двух разных объектов как в каталоге."));
            var lines = new List<string>();
            foreach (var p in matches)
            {
                var rates = await ApprovedAsync(p.Id);
                var price = p.TotalShares > 0 && p.Price > 0 ? Usd(p.Price / p.TotalShares) : L("unknown", "неизвестна");
                var stress = rates is null ? L("approved stress rate unknown", "утверждённая стрессовая ставка отсутствует")
                    : L($"conditional stress {rates.Rates.Negative}% per year ({rates.Source}, {rates.AsOf:yyyy-MM-dd})",
                        $"условный стресс {rates.Rates.Negative}% в год ({rates.Source}, {rates.AsOf:yyyy-MM-dd})");
                var valuation = p.TotalShares > 0 && p.RealPrice > 0 ? Usd(p.RealPrice.Value / p.TotalShares) : L("unknown", "неизвестна");
                lines.Add(L($"{p.Title}: offer {price} per share, saved value {valuation} per share, {p.AvailableShares} available, {stress}.",
                    $"{p.Title}: цена доли {price}, сохранённая оценка доли {valuation}, доступно долей {p.AvailableShares}, {stress}."));
            }
            return Reply(string.Join("\n", lines) + "\n" + L("Prices can fall. Availability may change.", "Стоимость может снизиться. Наличие долей может измениться."));
        }

        var criterion = Regex.Match(input, @"(?:budget|бюджет)\s+(\d{1,9})(?![\d.,])", RegexOptions.IgnoreCase);
        if (!criterion.Success)
            return Reply(L("Add an explicit USD limit, for example “Recommend properties with budget 1000”.",
                "Укажите лимит в USD, например «Подбери объект, бюджет 1000»."));
        var budget = decimal.Parse(criterion.Groups[1].Value, CultureInfo.InvariantCulture);
        var owner = user.GetUserId();
        var demo = user.IsDemo();
        var balance = demo
            ? await db.DemoUsers.Where(x => x.Id == owner).Select(x => (decimal?)x.WalletBalance).SingleOrDefaultAsync(ct)
            : await db.Users.Where(x => x.Id == owner).Select(x => (decimal?)x.WalletBalance).SingleOrDefaultAsync(ct);
        if (balance is null) return Reply(L("Wallet data is unavailable.", "Данные кошелька недоступны."));
        var holdings = demo
            ? await db.DemoInvestments.Where(x => x.DemoUserId == owner && x.Shares > 0).Select(x => x.PropertyId).ToListAsync(ct)
            : await db.Investments.Where(x => x.UserId == owner && x.Shares > 0).Select(x => x.PropertyId).ToListAsync(ct);
        if (!demo)
            holdings.AddRange(await db.ShareOffers.Where(x => x.SellerId == owner && x.IsActive && x.ExpirationDate > DateTime.UtcNow && x.SharesForSale > 0)
                .Select(x => x.PropertyId).ToListAsync(ct));

        var limit = Math.Min(budget, balance.Value);
        var candidates = properties.Where(p => p.Status == "available" && p.AvailableShares > 0 &&
                p.TotalShares > 0 && p.Price > 0)
            .Select(p => new { p.Id, p.Title, Cost = p.Price / p.TotalShares })
            .Where(p => p.Cost <= limit).OrderBy(p => holdings.Contains(p.Id)).ThenBy(p => p.Cost).ThenBy(p => p.Id).Take(3);
        var suggestions = new List<string>();
        foreach (var p in candidates)
        {
            var rates = await ApprovedAsync(p.Id);
            var exposure = holdings.Contains(p.Id)
                ? L("Already held or listed in your portfolio. Another share adds exposure to this property.",
                    "Объект уже есть в портфеле или выставлен вами на продажу. Ещё одна доля увеличит вложение в этот объект.")
                : L("Adds a different property to your holdings.", "Добавляет другой объект в портфель.");
            var risk = rates is null
                ? L("No current approved rates.", "Актуальных утверждённых ставок нет.")
                : L($"Conditional stress {rates.Rates.Negative}% per year ({rates.Source}, {rates.AsOf:yyyy-MM-dd}).",
                    $"Условный стресс {rates.Rates.Negative}% в год ({rates.Source}, {rates.AsOf:yyyy-MM-dd}).");
            suggestions.Add(L($"{p.Title}: one available share costs {Usd(p.Cost)}.", $"{p.Title}: цена одной доступной доли {Usd(p.Cost)}.")
                + $" {exposure} {risk}");
        }
        return Reply(L($"Limit with your wallet balance: {Usd(limit)}. Options outside your holdings appear first, then by price within each group.",
            $"Лимит с учётом баланса: {Usd(limit)}. Сначала показаны объекты вне портфеля, затем варианты отсортированы по цене в каждой группе.")
            + "\n" + (suggestions.Count == 0 ? L("No eligible options in the screened catalog.", "Подходящих предложений среди проверенных нет.")
                : string.Join("\n", suggestions) + "\n" + L("These options can lose value. Price and availability may change.",
                    "Цена и наличие долей могут измениться. Стоимость вложения может снизиться.")));

        async Task<ForecastRateApproval?> ApprovedAsync(Guid id)
        {
            var local = await ForecastRateJournal.ReadAsync(db, id, ct);
            return ForecastRateJournal.IsCurrent(local, today) ? local : ForecastRateJournal.IsCurrent(global, today) ? global : null;
        }
    }

    private static string Usd(decimal value) => value.ToString("0.00", CultureInfo.InvariantCulture) + " USD";
}
