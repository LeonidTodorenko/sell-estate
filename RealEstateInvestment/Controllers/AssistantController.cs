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
public sealed class AssistantController(AppDbContext db, AssistantKnowledge knowledge, AssistantProviderProbe provider, GeminiFaqAdapter gemini, AssistantLanguageSession language) : ControllerBase
{
    private const int PageSize = 25;

    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    public sealed record Question([Required, StringLength(400)] string Text);

    [HttpPost("ask")]
    [RequestTimeout(AssistantRegistration.AskTimeoutPolicy)]
    [RequestSizeLimit(4096)]
    public async Task<IActionResult> Ask(Question question, CancellationToken ct)
    {
        if (await FinancialActor.ValidateAsync(User, db, ct) is { } denied) return denied;
        var preference = language.Resolve(HttpContext, question.Text);
        if (preference.Changed)
            return Ok(new AssistantAnswer("language_changed", AssistantKnowledge.Version, null,
                preference.Russian ? "Теперь я отвечаю по-русски." : "I will answer in English.",
                Array.Empty<string>()) { Language = preference.Russian ? "ru" : "en" });

        var (answer, exact, russian) = knowledge.Match(question.Text, preference.Russian);
        if (answer.Status == "answered")
            await provider.CheckAsync(ct);
        if (exact && !User.IsDemo())
            answer = await gemini.PresentAsync(answer, russian, ct);
        return Ok(answer with { Language = russian ? "ru" : "en" });
    }

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
