using System.Diagnostics;
using System.Text.RegularExpressions;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Services.Assistant;
using RealEstateInvestment.Services.Forecast;

namespace RealEstateInvestment.Controllers;

[ApiController]
[Route("api/assistant")]
[Authorize(Policy = AssistantRegistration.Policy)]
[EnableRateLimiting(AssistantRegistration.Policy)]
[RequestTimeout(AssistantRegistration.Policy)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AssistantController(AppDbContext db, AssistantKnowledge knowledge, IAssistantConversationProvider provider, AssistantLanguageSession language, ILogger<AssistantController> logger) : ControllerBase
{
    private const int PageSize = 25;

    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    public sealed record Question([Required, StringLength(400)] string Text, Guid? ConversationId = null, bool AllowExternal = false, Guid? PropertyId = null);

    public sealed record InvestmentAnswer(string Text, ForecastResponse Chart);

    [HttpPost("investment-forecast/{propertyId:guid}")]
    [RequestSizeLimit(4096)]
    public async Task<ActionResult<InvestmentAnswer>> Forecast(Guid propertyId, ForecastRequest request, CancellationToken ct)
    {
        if (await FinancialActor.ValidateAsync(User, db, ct) is { } denied)
            return new ActionResult<InvestmentAnswer>((ActionResult)denied);

        var property = await db.Properties.ExcludeTechnicalFixtures().AsNoTracking().Include(p => p.PaymentPlans)
            .SingleOrDefaultAsync(p => p.Id == propertyId && p.Status != "declined", ct);
        if (property is null) return NotFound();
        if (property.TotalShares > 0 && request.Shares > property.TotalShares)
        {
            ModelState.AddModelError("shares", "Shares cannot exceed the total shares of the property.");
            return ValidationProblem(ModelState);
        }

        var chart = InvestmentForecast.Calculate(property, request, request.AsOf ?? DateOnly.FromDateTime(DateTime.UtcNow));
        return new InvestmentAnswer("These scenarios use your assumptions and the saved property valuation. Prices can fall and payouts are uncertain.", chart);
    }

    [HttpGet("property-insights/{propertyId:guid}")]
    public async Task<IActionResult> PropertyInsights(Guid propertyId, CancellationToken ct)
    {
        if (await FinancialActor.ValidateAsync(User, db, ct) is { } denied) return denied;
        if (!await db.Properties.ExcludeTechnicalFixtures().AnyAsync(p => p.Id == propertyId && p.Status != "declined", ct)) return NotFound();
        var conversation = new AssistantLanguageSession.Conversation();
        return Ok(await ScenarioConversation.ReadAsync(db, "Show forecast", conversation, ct, User.IsDemo(), propertyId));
    }

    [HttpGet("portfolio-insights")]
    public async Task<IActionResult> PortfolioInsights(CancellationToken ct)
    {
        if (await FinancialActor.ValidateAsync(User, db, ct) is { } denied) return denied;
        var owner = User.GetUserId();
        var demo = User.IsDemo();
        var balance = demo
            ? await db.DemoUsers.Where(x => x.Id == owner).Select(x => x.WalletBalance).SingleAsync(ct)
            : await db.Users.Where(x => x.Id == owner).Select(x => x.WalletBalance).SingleAsync(ct);
        var holdings = demo
            ? await db.DemoInvestments.AsNoTracking().Where(x => x.DemoUserId == owner && x.Shares > 0)
                .Select(x => new { x.PropertyId, x.InvestedAmount }).ToListAsync(ct)
            : await db.Investments.AsNoTracking().Where(x => x.UserId == owner && x.Shares > 0)
                .Select(x => new { x.PropertyId, x.InvestedAmount }).ToListAsync(ct);
        var positions = holdings.GroupBy(x => x.PropertyId).Select(g => g.Sum(x => x.InvestedAmount)).ToArray();
        var invested = positions.Sum();
        decimal? concentration = invested > 0 && positions.All(x => x >= 0)
            ? Math.Round(positions.Max() / invested * 100, 1) : null;
        return Ok(new { demo, balance, propertyCount = positions.Length, invested, concentration });
    }

    private const string DubaiSource = "https://dubailand.gov.ae/en/open-data/real-estate-data/";

    public sealed record DubaiMarketSnapshot(
        string District, string PropertyType, string RegistrationType, DateOnly From, DateOnly Through,
        DateOnly ApprovedOn, int SampleSize, decimal MedianAedPerSquareMetre);

    public sealed record DubaiMarketAnswer(string Status, string SourceUrl, string Method, DubaiMarketSnapshot? Snapshot);

    [HttpGet("dubai-market")]
    public async Task<ActionResult<DubaiMarketAnswer>> DubaiMarket([FromServices] IConfiguration configuration, CancellationToken ct)
    {
        if (await FinancialActor.ValidateAsync(User, db, ct) is { } denied)
            return new ActionResult<DubaiMarketAnswer>((ActionResult)denied);

        return MarketData(configuration);
    }

    private DubaiMarketAnswer MarketData(IConfiguration configuration)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return language.CachedMarket(configuration, today, () => ReadMarket(configuration, today));
    }

    private static DubaiMarketAnswer ReadMarket(IConfiguration configuration, DateOnly today)
    {
        const string method = "Median AED per square metre of registered sales in the stated district, property type and registration type.";
        var section = configuration.GetSection("Assistant:DubaiMarket:ApprovedSnapshot");
        string? district = section["District"]?.Trim();
        string? propertyType = section["PropertyType"]?.Trim();
        string? registrationType = section["RegistrationType"]?.Trim();
        if (district is not { Length: > 0 and <= 100 } || propertyType is not { Length: > 0 and <= 100 } ||
            registrationType is not { Length: > 0 and <= 100 } ||
            !ParseDay(section["From"], out var from) || !ParseDay(section["Through"], out var through) ||
            !ParseDay(section["ApprovedOn"], out var approvedOn) || from > through || through > approvedOn || approvedOn > today ||
            !int.TryParse(section["SampleSize"], out var sampleSize) || sampleSize < 1 ||
            !decimal.TryParse(section["MedianAedPerSquareMetre"], System.Globalization.NumberStyles.AllowDecimalPoint,
                System.Globalization.CultureInfo.InvariantCulture, out var median) || median <= 0)
            return new DubaiMarketAnswer("no_data", DubaiSource, method, null);

        var snapshot = new DubaiMarketSnapshot(district, propertyType, registrationType, from, through, approvedOn, sampleSize, median);
        var stale = today.DayNumber - through.DayNumber > 31 || today.DayNumber - approvedOn.DayNumber > 31;
        return new DubaiMarketAnswer(stale ? "stale" : "historical", DubaiSource, method, snapshot);

        static bool ParseDay(string? value, out DateOnly day) => DateOnly.TryParseExact(value, "yyyy-MM-dd",
            System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out day);
    }

    [HttpDelete("conversations/{id:guid}")]
    public async Task<IActionResult> ResetConversation(Guid id, CancellationToken ct)
    {
        if (await FinancialActor.ValidateAsync(User, db, ct) is { } denied) return denied;
        language.Reset(HttpContext, id);
        return NoContent();
    }

    [HttpPost("ask")]
    [RequestTimeout(AssistantRegistration.AskTimeoutPolicy)]
    [RequestSizeLimit(4096)]
    public async Task<IActionResult> Ask(Question question, CancellationToken ct)
    {
        if (await FinancialActor.ValidateAsync(User, db, ct) is { } denied) return denied;
        var (id, conversation) = language.Open(HttpContext, question.ConversationId);
        if (!conversation.Slot.Wait(0, ct)) return StatusCode(429);
        try
        {
            if (!question.AllowExternal) conversation.Turns.Clear();
            var input = question.Text.Trim();
            AssistantAnswer answer;
            if (AssistantLanguageSession.LanguageCommand(input) is { } russian)
            {
                conversation.Russian = russian;
                conversation.LanguageSelected = true;
                answer = Reply("language_changed", null, russian ? "Теперь я отвечаю по-русски." : "I will answer in English.");
            }
            else if (RequestsSources(input))
            {
                answer = Reply("answered", null, conversation.Russian
                    ? (conversation.LastSourceSections.Count > 0 ? "Источники предыдущего ответа." : "Для предыдущего ответа нет ссылок на источники.")
                    : (conversation.LastSourceSections.Count > 0 ? "Sources for the previous answer." : "There are no source links for the previous answer."))
                    with { SourceSections = conversation.LastSourceSections };
            }
            else
            {
                if (question.PropertyId is { } propertyId && conversation.Scenario is null)
                    conversation.Scenario = new(PropertyId: propertyId);
                answer = await RespondAsync(input, question.AllowExternal && question.PropertyId is null, conversation, ct);
                conversation.LastSourceSections = answer.SourceSections;
                answer = answer with { SourceSections = [] };
            }

            var clientAnswer = answer.SourceLinks.Count > 0
                ? answer
                : AssistantPresentation.ForClient(answer, conversation.Russian);
            return Ok(clientAnswer with { ConversationId = id, TraceId = HttpContext.TraceIdentifier, Language = conversation.Russian ? "ru" : "en" });
        }
        finally
        {
            conversation.Slot.Release();
        }
    }

    private static bool RequestsSources(string question) => question.TrimEnd('.', '!', '?').ToLowerInvariant() switch
    {
        "show sources" or "show technical sources" or "sources" or
        "покажи источники" or "покажи технические источники" or "источники" => true,
        _ => false
    };

    private static readonly Regex PrivateInput = new(
        @"[@/\\=_`<>]|[0-9]{3}|[a-z0-9-]{25,}|\b(?:jwt|bearer|secret|api key|token|password|pin|passcode|iban|swift|passport|credential\w*|kyc|ssn|routing number|card number|bank statement|account number|личн\w*|парол\w*|секрет\w*|паспорт\w*|реквизит\w*|снилс|инн)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex OtherAccount = new(
        @"\b(?:another|someone else|other (?:user|investor|account)|all (?:users|investors)|account (?:for|of)|for user|чуж\w*|другого пользователя)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static Regex Intent(string pattern) => new(pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex Personal = Intent(@"\b(?:my|mine|i (?:have|own|invested|got|hold|afford)|have i|for me|мои|мой|мою|моих|моего|моём|мне|у меня|я вложил\w*)\b");
    private static readonly Regex AccountFollowUp = Intent(@"^(?:and )?(?:how many(?: are there)?|what about (?:them|it)|how much(?: in total)?|а?\s*сколько(?: всего)?)\??$");
    private static readonly Regex Cyrillic = Intent(@"[а-яё]");
    private static readonly Regex Injection = Intent(@"\b(?:ignore (?:previous|all|system)|system prompt|(?:user|account)\s*id|impersonat\w*|обойди|игнорируй|идентификатор пользователя)\b");
    private static readonly Regex AllocationIntent = Intent(
        @"\b(?:(?:portfolio|asset|assets) (?:allocation|composition|structure|breakdown)|(?:allocation|composition|structure|breakdown) of (?:my |the )?(?:portfolio|assets)|(?:структур|состав|распределени)\w* (?:моего |моих )?(?:портфел|актив)\w*)\b");
    private static readonly (string Topic, Regex Terms)[] FinancialTopics =
    [
        ("purchase-plan", Intent(@"\b(?:can i (?:buy|afford)|how much (?:more )?(?:do i )?need (?:to buy|for)|plan (?:a|my) purchase|buy\s+[\d-]+\s+shares?|^\s*[\d-]+\s+shares?|shortfall|(?:могу|смогу)\s+(?:ли\s+)?(?:я\s+)?купить|купить\s+\S+\s+дол\w*|^\s*[\d-]+\s+дол\w*|план\w*\s+покуп\w*|не хватает)\b")),
        ("payment-plan", Intent(@"\b(?:payment schedules?|installment schedules?|график\w*\s+плат[её]ж\w*|(?:payment plans?|план\w*\s+плат[её]ж\w*|этап\w*\s+оплат\w*)\s+(?:of|in|for|at|в|для|объект[ае]?))\b")),
        ("assets", Intent(@"\b(?:total assets|(?:my|all) assets|portfolio value|актив\w*|стоимость портфеля)\b")),
        ("rental-income", Intent(@"\b(?:projected rent(?:al income)?|(?:my|monthly|estimated) rent(?:al income)?|rental income|прогноз\w* аренд\w*|арендн\w* доход\w*|доход\w* от аренды)\b")),
        ("market", Intent(@"\b(?:shares (?:on (?:the )?market|listed|for sale)|my (?:active )?listings|listed shares|дол\w* на (?:рынке|продаже)|выставлен\w* дол\w*|дол\w* выставлен\w*)\b")),
        ("balance", Intent(@"\b(?:wallet balance|available (?:funds|balance|cash)|how (?:many|much) money (?:i|do i|have i)|how much (?:do i have|is in my wallet)|баланс\w*|сколько (?:у меня )?(?:денег|средств)|доступн\w* (?:средств\w*|денег)|сколько \w* на кошельке)\b|^(?:my )?wallet[.?!]?$|^кошел[её]к[.?!]?$")),
        ("investments", Intent(@"\b(?:what shares (?:i|do i|have i)|(?:my|owned|held) shares|holdings|investments?|invested|инвестици\w*|вложени\w*|(?:какие|сколько|мои) дол\w*|дол\w* у меня)\b")),
        ("applications", Intent(@"\b(?:applications?|заяв\w*)\b")),
        ("payments", Intent(@"\b(?:payments?|transactions?|плат[её]ж\w*|транзакци\w*)\b"))
    ];

    private static readonly Regex GeneralDefinition = Intent(@"^(?:what (?:is|are)|explain|что такое)\b");
    private static readonly Regex HoldingTerms = Intent(@"\b(?:holdings|shares|дол\w*)\b");
    private static readonly Regex ApplicationTerms = Intent(@"\b(?:pending|open|carried|status|открыт\w*|ожида\w*|статус|в обработке|на рассмотрении)\b");
    private static bool IsAccountRequest(string topic, string input, bool personal) => topic switch
    {
        "investments" => personal || HoldingTerms.IsMatch(input),
        "applications" => personal || ApplicationTerms.IsMatch(input),
        "payments" => personal,
        "rental-income" or "market" or "balance" => personal || !GeneralDefinition.IsMatch(input),
        _ => true
    };

    private async Task<AssistantAnswer> RespondAsync(string input, bool allowExternal,
        AssistantLanguageSession.Conversation conversation, CancellationToken ct)
    {
        var allocation = AllocationIntent.IsMatch(input);
        if (!allocation && !OtherAccount.IsMatch(input) && !Injection.IsMatch(input) && !Regex.IsMatch(input, @"[@/\\=_`<>]") &&
            !Regex.IsMatch(input, @"\b(?:password|passport|token|secret|парол\w*|паспорт\w*|секрет\w*)\b", RegexOptions.IgnoreCase))
        {
            if (Intent(@"(?:dubai market|market (?:data|analytics) (?:for|in) dubai|рын\w*\s+дуба|аналитик\w*\s+дуба)").IsMatch(input))
            {
                if (!conversation.LanguageSelected) conversation.Russian = Cyrillic.IsMatch(input);
                conversation.Turns.Clear();
                conversation.AccountTopic = null;
                var market = MarketData(HttpContext.RequestServices.GetRequiredService<IConfiguration>());
                var summary = market.Snapshot is { } row
                    ? $"{row.District} · {row.PropertyType} · {row.RegistrationType} · {row.From:yyyy-MM-dd} – {row.Through:yyyy-MM-dd} · {row.MedianAedPerSquareMetre} AED/m² · n={row.SampleSize}. "
                        + (conversation.Russian ? "Медиана зарегистрированных продаж. " : "Median of registered sales. ")
                        + (market.Status == "stale" ? conversation.Russian ? "Данные устарели. " : "Data is stale. " : "")
                        + (conversation.Russian ? "Исторические сделки не определяют будущий рост." : "Historical transactions do not establish future growth.")
                    : conversation.Russian ? "Подтверждённых данных о рынке Дубая пока нет." : "Approved Dubai market data is unavailable.";
                return Reply("answered", "dubai-market", summary) with { SourceLinks = [new("Dubai Land Department", market.SourceUrl)] };
            }
            if (await InvestmentChoices.ReadAsync(db, User, input, conversation, ct) is { } choices) return choices;
            if (await ScenarioConversation.ReadAsync(db, input, conversation, ct, User.IsDemo()) is { } scenario) return scenario;
        }
        var russian = conversation.Russian;
        var personal = Personal.IsMatch(input);
        var topic = allocation ? "assets" : FinancialTopics.FirstOrDefault(candidate =>
            candidate.Terms.IsMatch(input) && IsAccountRequest(candidate.Topic, input, personal)).Topic;
        var followUp = AccountFollowUp.IsMatch(input);
        if (followUp && conversation.AccountTopic is not ("purchase-plan" or "payment-plan")) topic = conversation.AccountTopic;
        if (topic is not null && !OtherAccount.IsMatch(input) && !Injection.IsMatch(input) &&
            (!PrivateInput.IsMatch(input) || (topic is "purchase-plan" or "payment-plan" &&
                !PrivateInput.IsMatch(Regex.Replace(input, @"\b[0-9]{3,9}\b", "")))))
        {
            conversation.AccountTopic = topic;
            conversation.Turns.Clear();
            if (!conversation.LanguageSelected && !followUp) conversation.Russian = Cyrillic.IsMatch(input);
            try
            {
                return await new PersonalFinanceReader(db, User, conversation.Russian).ReadAsync(topic, input, ct);
            }
            catch (System.Data.Common.DbException) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning("Assistant financial data unavailable {TraceId}", HttpContext.TraceIdentifier);
                return Reply("unknown", null, conversation.Russian
                    ? "Финансовые данные временно недоступны. Повторите запрос."
                    : "Account data is temporarily unavailable. Try again.");
            }
        }

        conversation.AccountTopic = null;
        if (PrivateInput.IsMatch(input) && knowledge.Match(input, russian) is { Exact: true, Answer: var verified })
            return verified;
        if (OtherAccount.IsMatch(input) || PrivateInput.IsMatch(input) || (Injection.IsMatch(input) && (topic is not null || personal)))
            return Reply("unknown", null, russian
                ? "Задайте общий вопрос без личных данных или спросите о своём балансе, инвестициях, заявках или платежах."
                : "Ask a general question without private details, or ask about your own balance, investments, applications, or payments.");

        var previous = conversation.Turns.LastOrDefault()?.Question;
        var local = knowledge.LocalAnswer(input, previous, russian);
        if (personal) return local;
        if (!allowExternal)
        {
            logger.LogInformation("Assistant {TraceId} {Reason}", HttpContext.TraceIdentifier, "consent_missing");
            return LocalFallback(local, "consent_required", russian
                ? "Включите Gemini, чтобы начать диалог." : "Enable Gemini to start a live conversation.");
        }

        var sources = knowledge.Retrieve(input, previous)
            .Where(source => AssistantPresentation.CleanText(source.Answer) != null).ToArray();
        var started = Stopwatch.GetTimestamp();
        var result = await provider.GenerateAsync(input, russian, conversation.Turns.ToArray(), sources, ct);
        logger.LogInformation(
            "Assistant {TraceId} {Reason} provider_status={ProviderStatus} duration_ms={DurationMs} source_count={SourceCount} retry_after_s={RetryAfterSeconds}",
            HttpContext.TraceIdentifier, result.Reason, result.ProviderStatus,
            (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds, sources.Length, result.RetryAfterSeconds);

        if (result.Answer is not { } generated)
        {
            if (result.Reason is "local_rate_limit" or "provider_429" or "provider_busy")
            {
                var seconds = result.RetryAfterSeconds ?? 60;
                return Reply("retry_later", null, russian
                    ? $"Чат пока занят. Повторите сообщение через {seconds} сек."
                    : $"Live chat is busy. Try your message again in {seconds} seconds.");
            }
            return LocalFallback(local, "faq_fallback", russian
                ? "Живой чат временно недоступен." : "Live chat is temporarily unavailable.");
        }

        if (conversation.Turns.Count == 4) conversation.Turns.RemoveAt(0);
        conversation.Turns.Add(new AssistantTurn(input, generated.Answer));
        return generated;
    }

    private static AssistantAnswer LocalFallback(AssistantAnswer local, string status, string notice) =>
        local with { Status = status, Answer = local.Status == "unknown" ? notice : $"{notice} {local.Answer}" };

    private static AssistantAnswer Reply(string status, string? topic, string text) =>
        new(status, AssistantKnowledge.Version, topic, text, []);

    [HttpGet("me/balance")]
    public async Task<IActionResult> Balance(CancellationToken ct)
    {
        if (await FinancialActor.ValidateAsync(User, db, ct) is { } denied) return denied;
        var id = User.GetUserId();
        var demo = User.IsDemo();
        var balance = demo
            ? await db.DemoUsers.AsNoTracking().Where(x => x.Id == id).Select(x => (decimal?)x.WalletBalance).SingleOrDefaultAsync(ct)
            : await db.Users.AsNoTracking().Where(x => x.Id == id).Select(x => (decimal?)x.WalletBalance).SingleOrDefaultAsync(ct);
        return balance.HasValue ? Ok(new { balance, currency = "USD", demo }) : NotFound();
    }

    [HttpGet("me/investments")]
    public async Task<IActionResult> Investments(CancellationToken ct)
    {
        if (await FinancialActor.ValidateAsync(User, db, ct) is { } denied) return denied;
        var id = User.GetUserId();
        var demo = User.IsDemo();
        var rows = demo
            ? db.DemoInvestments.AsNoTracking().Where(x => x.DemoUserId == id)
                .Select(x => new { x.Id, x.PropertyId, x.Shares, x.InvestedAmount, x.CreatedAt })
            : db.Investments.AsNoTracking().Where(x => x.UserId == id)
                .Select(x => new { x.Id, x.PropertyId, x.Shares, x.InvestedAmount, x.CreatedAt });
        return Ok(new { demo, limit = PageSize, items = await rows.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Take(PageSize).ToListAsync(ct) });
    }

    [HttpGet("me/applications")]
    public async Task<IActionResult> Applications(CancellationToken ct)
    {
        if (await FinancialActor.ValidateAsync(User, db, ct) is { } denied) return denied;
        var id = User.GetUserId();
        var demo = User.IsDemo();
        var rows = demo
            ? db.DemoInvestmentApplications.AsNoTracking().Where(x => x.DemoUserId == id)
                .Select(x => new { x.Id, x.PropertyId, x.RequestedShares, x.Status, x.CreatedAt })
            : db.InvestmentApplications.AsNoTracking().Where(x => x.UserId == id)
                .Select(x => new { x.Id, x.PropertyId, x.RequestedShares, x.Status, x.CreatedAt });
        return Ok(new { demo, limit = PageSize, items = await rows.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Take(PageSize).ToListAsync(ct) });
    }

    [HttpGet("me/payments")]
    public async Task<IActionResult> Payments(CancellationToken ct)
    {
        if (await FinancialActor.ValidateAsync(User, db, ct) is { } denied) return denied;
        if (User.IsDemo()) return Ok(new { demo = true, status = "unavailable_in_demo", items = Array.Empty<object>() });
        var id = User.GetUserId();
        var items = await db.Payments.AsNoTracking().Where(x => x.UserId == id)
            .OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Take(PageSize)
            .Select(x => new { x.Id, x.Method, x.Status, x.WalletAmount, x.WalletCurrency, x.IsTest, x.CreatedAt, x.CreditedAt })
            .ToListAsync(ct);
        return Ok(new { demo = false, limit = PageSize, items });
    }
}
