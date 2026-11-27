using System.Data;
using System.Globalization;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;

namespace RealEstateInvestment.Services.Assistant;

// This reader is invoked only by the authorized controller. Neither its inputs nor its
// results become Gemini tools, provider history, or instructions.
internal sealed class PersonalFinanceReader(AppDbContext db, ClaimsPrincipal principal, bool russian)
{
    private readonly Guid owner = principal.GetUserId();
    private readonly bool demo = principal.IsDemo();

    private sealed record Holding(Guid PropertyId, string Title, int Shares, decimal Invested, decimal Price, int Capacity, decimal Rent);
    private sealed record Application(string Title, int Shares, decimal Amount, string Status, DateTime Created,
        decimal Price, int Capacity);
    private sealed record Offer(string Title, int Shares, decimal Price, int Capacity);

    private string L(string en, string ru) => russian ? ru : en;
    private static string Money(decimal amount) => amount.ToString("0.00", CultureInfo.InvariantCulture) + " USD";
    private static string QuoteMoney(decimal amount) => amount.ToString("0.00##########################", CultureInfo.InvariantCulture) + " USD";
    private static decimal Value(decimal amount, int capacity, int shares) => capacity > 0 ? amount / capacity * shares : 0m;
    private static string Label(string title) => new(title.Where(c => char.IsLetterOrDigit(c) || " .,-&()".Contains(c)).Take(100).ToArray());

    public async Task<AssistantAnswer> ReadAsync(string topic, string input, CancellationToken ct)
    {
        // PostgreSQL needs a stable snapshot across the wallet, positions, capacity and stages.
        // SQLite's native equivalent for the isolated tests is Serializable.
        await using var snapshot = await db.Database.BeginTransactionAsync(
            db.Database.ProviderName == "Microsoft.EntityFrameworkCore.Sqlite" ? IsolationLevel.Serializable : IsolationLevel.RepeatableRead, ct);
        var now = DateTime.UtcNow;
        var balance = demo
            ? await db.DemoUsers.AsNoTracking().Where(x => x.Id == owner).Select(x => (decimal?)x.WalletBalance).SingleOrDefaultAsync(ct)
            : await db.Users.AsNoTracking().Where(x => x.Id == owner).Select(x => (decimal?)x.WalletBalance).SingleOrDefaultAsync(ct);
        if (balance is null) return Answer(topic, L("Account data is unavailable.", "Данные счёта недоступны."), now, "OwnersClub Wallet");

        var result = topic switch
        {
            "purchase-plan" or "payment-plan" => await PlanAsync(topic, input, balance.Value, now, ct),
            "balance" => Answer(topic, L($"Available wallet balance: {Money(balance.Value)}.", $"Доступно в кошельке: {Money(balance.Value)}."),
                now, "OwnersClub Wallet"),
            "payments" => await PaymentsAsync(now, ct),
            _ => await PortfolioAsync(topic, balance.Value, now, ct)
        };
        await snapshot.CommitAsync(ct);
        return result;
    }

    private async Task<AssistantAnswer> PortfolioAsync(string topic, decimal balance, DateTime now, CancellationToken ct)
    {
        var holdings = await (demo
            ? from i in db.DemoInvestments where i.DemoUserId == owner && i.Shares > 0
              join p in db.Properties on i.PropertyId equals p.Id
              select new Holding(p.Id, p.Title, i.Shares, i.InvestedAmount, p.Price, p.TotalShares, p.MonthlyRentalIncome)
            : from i in db.Investments where i.UserId == owner && i.Shares > 0
              join p in db.Properties on i.PropertyId equals p.Id
              select new Holding(p.Id, p.Title, i.Shares, i.InvestedAmount, p.Price, p.TotalShares, p.MonthlyRentalIncome)).ToListAsync(ct);

        if (topic == "investments")
        {
            var total = Money(holdings.Sum(x => x.Invested));
            var lines = holdings.GroupBy(x => new { x.PropertyId, x.Title }).OrderBy(x => x.Key.Title, StringComparer.Ordinal).ThenBy(x => x.Key.PropertyId)
                .Select(g => L($"{Label(g.Key.Title)}: {g.Sum(x => (long)x.Shares)} held shares, {Money(g.Sum(x => x.Invested))} invested.",
                    $"{Label(g.Key.Title)}: во владении {g.Sum(x => (long)x.Shares)} долей, вложено {Money(g.Sum(x => x.Invested))}."));
            return Answer(topic, L($"Investments: {holdings.Count}. Total invested: {total}.",
                $"Инвестиций: {holdings.Count}. Всего вложено: {total}.") + Details(lines), now, "OwnersClub Investments");
        }

        if (topic == "rental-income")
        {
            var estimate = Money(holdings.Sum(x => Value(Math.Max(0m, x.Rent), x.Capacity, x.Shares)));
            return Answer("rental-income", L($"Estimated gross rent per month: {estimate}. Based on configured property rent and shares held. Actual payouts and fees may differ. An unconfigured rate contributes zero to this estimate.",
                $"Расчётный валовой доход от аренды в месяц: {estimate}. Основан на заданной аренде и долях во владении. Фактические выплаты и комиссии могут отличаться. Если ставка не задана, объект даёт ноль в этом расчёте."),
                now, "OwnersClub Investments / Property rent");
        }

        var applications = await OpenApplicationsAsync(ct);
        if (topic == "applications")
        {
            var lines = applications.OrderByDescending(x => x.Created).ThenBy(x => x.Title, StringComparer.Ordinal)
                .Select(x => L($"{Label(x.Title)}: {x.Shares} shares, {Money(x.Amount)} requested, {x.Status}, {Day(x.Created)}.",
                    $"{Label(x.Title)}: {x.Shares} долей, сумма заявки {Money(x.Amount)}, {x.Status}, {Day(x.Created)}."));
            return Answer(topic, L($"Open applications (pending or carried): {applications.Count}.",
                $"Открытые заявки (на рассмотрении или перенесены): {applications.Count}.") + Details(lines),
                now, "OwnersClub Investment applications");
        }

        var offers = await (demo
            ? from o in db.DemoShareOffers where o.DemoSellerId == owner && o.IsActive
              join p in db.Properties on o.PropertyId equals p.Id
              select new Offer(p.Title, o.SharesForSale, p.Price, p.TotalShares)
            : from o in db.ShareOffers where o.SellerId == owner && o.IsActive
              join p in db.Properties on o.PropertyId equals p.Id
              select new Offer(p.Title, o.SharesForSale, p.Price, p.TotalShares)).ToListAsync(ct);
        var listed = offers.Sum(x => Value(x.Price, x.Capacity, x.Shares));
        if (topic == "market")
        {
            var lines = offers.GroupBy(x => x.Title).OrderBy(x => x.Key, StringComparer.Ordinal)
                .Select(g => L($"{Label(g.Key)}: {g.Sum(x => (long)x.Shares)} listed shares.",
                    $"{Label(g.Key)}: выставлено {g.Sum(x => (long)x.Shares)} долей."));
            return Answer("market", L($"Active listings: {offers.Count}. Shares listed: {offers.Sum(x => (long)x.Shares)}. Reference value at property price: {Money(listed)}.",
                $"Активных объявлений: {offers.Count}. Выставлено долей: {offers.Sum(x => (long)x.Shares)}. Оценка по цене объектов: {Money(listed)}.")
                + Details(lines), now, "OwnersClub Share offers");
        }

        var invested = holdings.Sum(x => Value(x.Price, x.Capacity, x.Shares));
        var pending = applications.Where(x => x.Status == "pending").Sum(x => Value(x.Price, x.Capacity, x.Shares));
        var totalAssets = Money(balance + invested + pending + listed);
        var unknown = holdings.Any(x => x.Capacity <= 0) || offers.Any(x => x.Capacity <= 0) ||
            applications.Any(x => x.Status == "pending" && x.Capacity <= 0);
        return Answer("balance", L(
            $"Total assets at reference prices: {totalAssets}. Wallet: {Money(balance)}; investments: {Money(invested)}; pending applications: {Money(pending)}; listed shares: {Money(listed)}. Asset values are estimates at property prices.",
            $"Всего активов по расчётной стоимости: {totalAssets}. Кошелёк: {Money(balance)}; инвестиции: {Money(invested)}; заявки на рассмотрении: {Money(pending)}; выставленные доли: {Money(listed)}. Оценка основана на ценах объектов.")
            + (unknown ? L(" Some positions have no valid share capacity and are excluded from valuation.",
                " Из оценки исключены позиции без корректного числа долей объекта.") : ""), now, "OwnersClub Total assets") with
        {
            Allocation = unknown ? null : new("USD", demo,
            [
                new(L("Wallet", "Кошелёк"), balance),
                new(L("Investments", "Инвестиции"), invested),
                new(L("Pending applications", "Заявки на рассмотрении"), pending),
                new(L("Listed shares", "Выставленные доли"), listed),
            ])
        };
    }

    private Task<List<Application>> OpenApplicationsAsync(CancellationToken ct) => (demo
        ? from a in db.DemoInvestmentApplications where a.DemoUserId == owner && (a.Status == "pending" || a.Status == "carried")
          join p in db.Properties on a.PropertyId equals p.Id
          select new Application(p.Title, a.RequestedShares, a.RequestedAmount, a.Status, a.CreatedAt, p.Price, p.TotalShares)
        : from a in db.InvestmentApplications where a.UserId == owner && (a.Status == "pending" || a.Status == "carried")
          join p in db.Properties on a.PropertyId equals p.Id
          select new Application(p.Title, a.RequestedShares, a.RequestedAmount, a.Status, a.CreatedAt, p.Price, p.TotalShares)).ToListAsync(ct);

    private async Task<AssistantAnswer> PaymentsAsync(DateTime now, CancellationToken ct)
    {
        if (demo) return Answer("payments", L("Payments are unavailable in Demo mode.", "Платежи недоступны в деморежиме."), now, "OwnersClub Wallet payments");
        var payments = await db.Payments.AsNoTracking().Where(x => x.UserId == owner)
            .OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Take(6)
            .Select(x => new { x.WalletAmount, x.WalletCurrency, x.Status, x.CreatedAt, x.IsTest }).ToListAsync(ct);
        var lines = payments.Select(x => $"{Day(x.CreatedAt)}: {x.WalletAmount:0.00} {Label(x.WalletCurrency)}, {x.Status}"
            + (x.IsTest ? L(" (test)", " (тест)") : ""));
        return Answer("payments", (payments.Count == 0 ? L("No payments recorded.", "Платежей нет.")
            : L("Latest payments.", "Последние платежи.") + Details(lines)), now, "OwnersClub Wallet payments");
    }

    private static readonly Regex Quantity = new(@"\b(?<n>[0-9]+)\s*(?:shares?\b|дол(?:я|ю|и|ей)\b)",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex SecondaryMarket = new(@"\b(?:secondary|resale|marketplace|from (?:another|a seller)|вторич\w*|на рынке|у продавца)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex InvalidQuantityPrefix = new(@"\d\s+$|[!+-.,−]\s*$", RegexOptions.CultureInvariant);
    private static readonly Regex ObjectTitle = new(@"\s(?:of|in|for|at|в|для|объект[ае]?)\s+(?<title>.+?)\s*[?!]*$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private async Task<AssistantAnswer> PlanAsync(string topic, string input, decimal balance, DateTime now, CancellationToken ct)
    {
        var purchase = topic == "purchase-plan";
        var quantity = Quantity.Match(input);
        var shares = 0;
        if (purchase && SecondaryMarket.IsMatch(input))
            return new("unknown", AssistantKnowledge.Version, "market",
                L("This calculator supports primary purchases. See Marketplace for individual resale prices, fees and conditions.",
                    "Этот расчёт доступен для первичной покупки. Цены, комиссии и условия конкретного предложения смотрите на рынке долей."), []);
        if (purchase && (!quantity.Success || !int.TryParse(quantity.Groups["n"].Value, out shares) || shares <= 0 ||
            InvalidQuantityPrefix.IsMatch(input[..quantity.Index]) || Quantity.Matches(input).Count != 1))
            return Clarify(L("How many whole shares would you like to buy, and in which property? For example, “Can I buy 2 shares in Property Name?”",
                "Сколько целых долей и в каком объекте? Например: «Могу ли я купить 2 доли в Название объекта?»"));
        var match = ObjectTitle.Match(purchase ? input[(quantity.Index + quantity.Length)..] : input);
        if (!match.Success)
            return Clarify(L("Which property? Use its exact title from Properties.", "Какой объект? Укажите точное название из каталога."));
        var title = match.Groups["title"].Value.Trim(' ', '"', '«', '»', '“', '”');
        var normalized = title.ToUpperInvariant();
        var properties = await db.Properties.AsNoTracking().Where(p => (p.Title == title || p.Title.ToUpper() == normalized) && p.Status != "declined")
            .Select(p => new { p.Id, p.Title, p.Price, p.TotalShares, p.AvailableShares, p.Status }).Take(2).ToListAsync(ct);
        if (properties.Count != 1)
            return Clarify(L("I couldn’t identify a unique listed property. Check the exact title in Properties.",
                "Не удалось однозначно определить объект. Проверьте точное название в каталоге."));
        var property = properties[0];
        var stages = InvestmentStages.Ordered(await db.PaymentPlans.AsNoTracking().Where(p => p.PropertyId == property.Id).ToListAsync(ct));
        var active = InvestmentStages.Active(stages, now);
        var stage = active ?? stages.LastOrDefault();
        if (stage == null)
            return Answer("payment-plan", L("No payment schedule is configured for this property.", "Для объекта не настроен план платежей."),
                now, "OwnersClub Payment plans");

        var schedule = stages.Select((s, index) => L(
            $"Stage {index + 1}: {Day(s.EventDate)} → {Day(s.DueDate)}, {s.Percentage:G}%, property total {Money(s.Total)}"
                + (s == stage ? " (current accounting stage)." : "."),
            $"Этап {index + 1}: {Day(s.EventDate)} → {Day(s.DueDate)}, {s.Percentage:G}%, всего по объекту {Money(s.Total)}"
                + (s == stage ? " (текущий расчётный этап)." : ".")));
        var scheduleText = L($"Property payment schedule for {Label(property.Title)}.", $"График платежей объекта {Label(property.Title)}.")
            + Details(schedule);
        if (!purchase) return Answer("payment-plan", scheduleText, now, "OwnersClub Payment plans");
        if (property.TotalShares <= 0 || property.Price <= 0)
            return Answer(topic, L("A valid share price is unavailable.", "Корректная цена доли недоступна."), now, "OwnersClub Properties");

        var available = (long)property.AvailableShares;
        if (demo)
        {
            var allocated = await db.DemoInvestments.Where(x => x.PropertyId == property.Id).SumAsync(x => (long)x.Shares, ct);
            var pending = await db.DemoInvestmentApplications.Where(x => x.PropertyId == property.Id && x.Status == "pending")
                .SumAsync(x => (long)x.RequestedShares, ct);
            var offered = await db.DemoShareOffers.Where(x => x.PropertyId == property.Id && x.IsActive)
                .SumAsync(x => (long)x.SharesForSale, ct);
            available = Math.Max(0, property.TotalShares - allocated - pending - offered);
        }

        var price = property.Price / property.TotalShares;
        var cost = price * shares;
        var shortfall = Math.Max(0m, cost - balance);
        var open = property.Status is not ("sold" or "declined" or "rented") && !(now < stages[0].EventDate);
        var reservation = active == stages[0];
        var ownApplications = await OpenApplicationsAsync(ct);
        var requested = Money(ownApplications.Sum(x => x.Amount));
        var reserves = await DescribeReservesAsync(ownApplications.Count, ct);
        var facts = L(
            $"Snapshot for {Label(property.Title)}. Price per share: {QuoteMoney(price)}. Available shares: {available}. Available wallet balance: {Money(balance)}. Open applications request {requested} in total.",
            $"Данные по объекту {Label(property.Title)}. Цена доли: {QuoteMoney(price)}. Свободно долей: {available}. Доступно в кошельке: {Money(balance)}. Сумма открытых заявок: {requested}.");
        var scenario = L(
            $"Primary purchase scenario: {shares} shares cost {QuoteMoney(cost)} in one debit. Purchase fee on this route: 0.00 USD. Shortfall: {QuoteMoney(shortfall)}.",
            $"Сценарий первичной покупки: {shares} долей стоят {QuoteMoney(cost)}, одним списанием. Комиссия покупки по этому маршруту: 0.00 USD. Не хватает: {QuoteMoney(shortfall)}.");
        var limits = !open ? L("The property is closed for applications at this time.", "Сейчас объект закрыт для заявок.")
            : shares > available ? L("There are too few available shares.", "Свободных долей недостаточно.")
            : shortfall > 0 ? L("The wallet balance is insufficient.", "Средств в кошельке недостаточно.")
            : reservation ? L("The current stage would reserve funds and shares pending a decision.", "На текущем этапе средства и доли резервируются до решения.")
            : L("The current stage would create an investment directly.", "На текущем этапе инвестиция оформляется сразу.");
        var uncertainty = L(
            "Existing debits are already reflected in the wallet. The open application subtotal does not verify a reservation for every historical request. Availability and stage are checked again at submission.",
            "Проведённые списания уже учтены в кошельке. Сумма открытых заявок сама по себе не подтверждает резерв по каждой исторической заявке. Остаток долей и этап проверяются заново при подаче.");
        return Answer(topic, string.Join("\n", facts, reserves, scenario, limits, uncertainty, scheduleText), now,
            "OwnersClub Wallet / Withdrawals", "OwnersClub Investment applications / Ledger", "OwnersClub Investment workflow / Payment plans");
    }

    private async Task<string> DescribeReservesAsync(int applicationCount, CancellationToken ct)
    {
        if (demo)
            return L("The wallet reflects simulated debits. An audited reserve total is unavailable for Demo accounts.",
                "Кошелёк учитывает учебные списания. Проверенная по журналу сумма резерва для демо-счёта недоступна.");

        var pendingWithdrawals = await db.WithdrawalRequests.AsNoTracking()
            .Where(x => x.UserId == owner && x.Status == "pending").Select(x => x.Amount).ToListAsync(ct);
        var withdrawals = L($"Pending withdrawals already debited: {Money(pendingWithdrawals.Sum())}.",
            $"Выводы в ожидании, уже списанные с кошелька: {Money(pendingWithdrawals.Sum())}.");
        var applications = await db.InvestmentApplications.AsNoTracking()
            .Where(x => x.UserId == owner && (x.Status == "pending" || x.Status == "carried"))
            .OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Take(5).ToListAsync(ct);
        var proved = 0m;
        var confirmed = 0;
        foreach (var application in applications)
        {
            ct.ThrowIfCancellationRequested();
            if (!await InvestmentReservationProof.Proven(db, application)) continue;
            proved += application.RequestedAmount;
            confirmed++;
        }
        var reserve = L($"Confirmed application reserve: {Money(proved)}.",
            $"Подтверждённый резерв по заявкам: {Money(proved)}.");
        var remaining = applicationCount - confirmed;
        if (remaining > 0)
            reserve += L($" Reserve amount unknown for {remaining} open applications.",
                $" Сумма резерва неизвестна для {remaining} открытых заявок.");
        return withdrawals + " " + reserve;
    }

    private AssistantAnswer Clarify(string text) => new("unknown", AssistantKnowledge.Version, "properties", text, []);

    private AssistantAnswer Answer(string topic, string text, DateTime now, params string[] sources) =>
        new("answered", AssistantKnowledge.Version, topic, text + "\n" +
            L($"As of {Day(now)} {now:HH:mm} UTC.", $"По состоянию на {Day(now)} {now:HH:mm} UTC.") +
            (demo ? L(" Demo account.", " Демо-счёт.") : ""), sources)
        { SourceLinks = sources.Select(source => new AssistantSource(source)).ToArray() };

    private static string Day(DateTime? date) => date?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? "—";

    private string Details(IEnumerable<string> lines)
    {
        var sample = lines.Take(6).ToArray();
        if (sample.Length == 0) return "";
        return "\n" + string.Join("\n", sample.Take(5))
            + (sample.Length > 5 ? "\n" + L("See the app for the remaining records.", "Остальные записи доступны в приложении.") : "");
    }
}
