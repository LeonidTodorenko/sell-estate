using System.Globalization;
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
public sealed class AssistantController(AppDbContext db, AssistantKnowledge knowledge, IAssistantConversationProvider provider, AssistantLanguageSession language) : ControllerBase
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
            var input = question.Text.Trim();
            AssistantAnswer answer;
            if (AssistantLanguageSession.LanguageCommand(input) is { } russian)
            {
                conversation.Russian = russian;
                answer = Reply("language_changed", null, russian ? "Теперь я отвечаю по-русски." : "I will answer in English.");
            }
            else
            {
                answer = await RespondAsync(input, question.AllowExternal, conversation, ct);
            }

            return Ok(answer with { ConversationId = id, Language = conversation.Russian ? "ru" : "en" });
        }
        finally
        {
            conversation.Slot.Release();
        }
    }

    private static readonly Regex PrivateInput = new(
        @"[@/\\=_`<>]|[0-9]{3}|[a-z0-9-]{25,}|\b(?:jwt|bearer|secret|api key|token|password|passcode|iban|swift|passport|credential\w*|kyc|ssn|routing number|card number|bank statement|account number|личн\w*|парол\w*|секрет\w*|паспорт\w*|реквизит\w*|снилс|инн)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex OtherAccount = new(
        @"\b(?:another|someone else|other (?:user|investor|account)|all (?:users|investors)|account (?:for|of)|for user|чуж\w*|другого пользователя)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex Personal = new(
        @"\b(?:my|mine|i have|i own|i invested|have i invested|мои|мой|мою|моих|моего|моём|у меня|я вложил\w*)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex AccountFollowUp = new(
        @"^(?:and )?(?:how many(?: are there)?|what about (?:them|it)|how much(?: in total)?|а?\s*сколько(?: всего)?)\??$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly (string Topic, Regex Terms)[] AccountTopics =
    [
        ("balance", new(@"\b(?:balance|баланс\w*)\b", RegexOptions.IgnoreCase)),
        ("investments", new(@"\b(?:investments?|invested|инвестици\w*|вложени\w*)\b", RegexOptions.IgnoreCase)),
        ("applications", new(@"\b(?:applications?|заяв\w*)\b", RegexOptions.IgnoreCase)),
        ("payments", new(@"\b(?:payments?|transactions?|плат[её]ж\w*|транзакци\w*)\b", RegexOptions.IgnoreCase))
    ];

    private async Task<AssistantAnswer> RespondAsync(string input, bool allowExternal,
        AssistantLanguageSession.Conversation conversation, CancellationToken ct)
    {
        var russian = conversation.Russian;
        if (!allowExternal) conversation.Turns.Clear();
        var fallback = russian ? "Ограниченный режим. " : "Limited mode. ";
        if (PrivateInput.IsMatch(input) && knowledge.Match(input, russian) is { Exact: true, Answer: var verified })
            return verified with { Answer = fallback + verified.Answer };
        if (OtherAccount.IsMatch(input) || PrivateInput.IsMatch(input))
            return Reply("unknown", null, russian
                ? "Задайте общий вопрос без личных данных или спросите о своём балансе, инвестициях, заявках или платежах."
                : "Ask a general question without private details, or ask about your own balance, investments, applications, or payments.");

        var topics = AccountTopics.Where(topic => topic.Terms.IsMatch(input)).Select(topic => topic.Topic).ToArray();
        var personal = Personal.IsMatch(input);
        var accountTopic = personal && topics.Length == 1 ? topics[0]
            : AccountFollowUp.IsMatch(input) ? conversation.AccountTopic : null;
        if (accountTopic != null)
        {
            conversation.AccountTopic = accountTopic;
            return await ReadAccountAsync(accountTopic, russian, ct);
        }
        conversation.AccountTopic = null;
        if (personal && topics.Length > 0)
            return Reply("unknown", null, russian
                ? "Что посмотреть в вашем аккаунте? Уточните: баланс, инвестиции, заявки или платежи."
                : "Which part of your account should I check: balance, investments, applications, or payments?");

        var previous = conversation.Turns.LastOrDefault()?.Question;
        var local = knowledge.LocalAnswer(input, previous, russian);
        if (!allowExternal || personal)
            return local with { Answer = fallback + local.Answer };

        var history = conversation.Turns.ToArray();
        var sources = knowledge.Retrieve(input, previous);
        var generated = await provider.GenerateAsync(input, russian, history, sources, ct);
        if (conversation.Turns.Count == 4) conversation.Turns.RemoveAt(0);
        conversation.Turns.Add(new AssistantTurn(input, generated?.Answer ?? ""));
        return generated ?? local with { Answer = fallback + local.Answer };
    }

    private async Task<AssistantAnswer> ReadAccountAsync(string topic, bool russian, CancellationToken ct)
    {
        var id = User.GetUserId();
        var demo = User.IsDemo();
        string text;
        switch (topic)
        {
            case "balance":
                var balance = demo
                    ? await db.DemoUsers.AsNoTracking().Where(x => x.Id == id).Select(x => x.WalletBalance).SingleAsync(ct)
                    : await db.Users.AsNoTracking().Where(x => x.Id == id).Select(x => x.WalletBalance).SingleAsync(ct);
                text = (russian ? "Баланс кошелька: " : "Wallet balance: ") +
                    balance.ToString("0.00", CultureInfo.InvariantCulture) + " USD.";
                break;
            case "investments":
                var amounts = demo
                    ? db.DemoInvestments.AsNoTracking().Where(x => x.DemoUserId == id).Select(x => x.InvestedAmount)
                    : db.Investments.AsNoTracking().Where(x => x.UserId == id).Select(x => x.InvestedAmount);
                var summary = await amounts.GroupBy(_ => 1)
                    .Select(group => new { Count = group.Count(), Total = group.Sum() }).SingleOrDefaultAsync(ct);
                var total = (summary?.Total ?? 0m).ToString("0.00", CultureInfo.InvariantCulture);
                text = russian ? $"Инвестиций: {summary?.Count ?? 0}. Всего вложено: {total} USD."
                    : $"Investments: {summary?.Count ?? 0}. Total invested: {total} USD.";
                break;
            case "applications":
                var applications = demo
                    ? await db.DemoInvestmentApplications.AsNoTracking().CountAsync(x => x.DemoUserId == id, ct)
                    : await db.InvestmentApplications.AsNoTracking().CountAsync(x => x.UserId == id, ct);
                text = russian ? $"Всего заявок: {applications}." : $"Total applications: {applications}.";
                break;
            default:
                if (demo)
                    return Reply("answered", topic, russian ? "Платежи недоступны в деморежиме." : "Payments are unavailable in Demo mode.");
                var payments = await db.Payments.AsNoTracking().CountAsync(x => x.UserId == id, ct);
                text = russian ? $"Всего платежей: {payments}." : $"Total payments: {payments}.";
                break;
        }
        return Reply("answered", topic, text);
    }

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
