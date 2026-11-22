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
    public sealed record Question([Required, StringLength(400)] string Text, Guid? ConversationId = null, bool AllowExternal = false);

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
                answer = await RespondAsync(input, question.AllowExternal, conversation, ct);
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
        var russian = conversation.Russian;
        var personal = Personal.IsMatch(input);
        var topic = FinancialTopics.FirstOrDefault(candidate =>
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
