using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers;

[ApiController]
[FinancialAdmin]
[FinancialConcurrency]
[Route("api/admin/investment-intents")]
public sealed class AdminInvestmentIntentsController(AppDbContext db) : ControllerBase
{
    // An absent committed journal is UNKNOWN, never proof that the client can create a new key.
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Find(Guid id)
    {
        if (id == Guid.Empty) return BadRequest();
        var t = await db.UserTransactions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id);
        if (t == null) return Ok(new { operationId = id, status = "unknown", canReset = false,
            message = "No committed journal found. Keep the saved UUID; absence does not prove failure. Demo intents are not supported." });
        if (t.Type != TransactionType.Investment) return Conflict(new { message = "UUID belongs to a different operation." });
        var source = await Source(t);
        var application = source.HasValue ? await db.InvestmentApplications.AsNoTracking().SingleOrDefaultAsync(x => x.Id == source && x.UserId == t.UserId && x.PropertyId == t.PropertyId) : null;
        var investment = source.HasValue ? await db.Investments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == source && x.UserId == t.UserId && x.PropertyId == t.PropertyId) : null;
        var reviews = await db.ActionLogs.AsNoTracking().Where(x => x.Action == "InvestmentIntentCommitVerified" && x.Details.Contains(id.ToString()))
            .OrderByDescending(x => x.Timestamp).Select(x => new { x.Id, actor = x.UserId, x.Timestamp }).ToListAsync();
        return Ok(new { operationId = id, status = source == null || (application == null && investment == null) ? "requires_reconciliation" : "committed",
            journal = new { t.Id, t.UserId, t.PropertyId, t.Type, t.Amount, t.Shares, t.Timestamp }, sourceId = source,
            application, investment, reviews, canReset = false,
            message = "A committed debit is recovered by retrying the original UUID and payload. Pending application status is separate. Never create a second debit or delete journals." });
    }

    public sealed class Verification
    {
        public Guid UserId { get; set; }
        public Guid PropertyId { get; set; }
        public decimal Amount { get; set; }
        public int Shares { get; set; }
        public bool IndependentlyVerified { get; set; }
        [Required, RegularExpression("^[A-Za-z][A-Za-z0-9_-]{7,79}$")]
        public string Reference { get; set; } = "";
    }

    // Records a reconciliation of an existing commit. It cannot debit, refund or clear an intent.
    [HttpPost("{id:guid}/verify-commit")]
    public async Task<IActionResult> VerifyCommit(Guid id, Verification request)
    {
        if (id == Guid.Empty || !request.IndependentlyVerified || !Regex.IsMatch(request.Reference ?? "", "^[A-Za-z][A-Za-z0-9_-]{7,79}$")) return BadRequest();
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var t = await db.UserTransactions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id);
        if (t == null) return Conflict(new { message = "Unknown outcome cannot be resolved from absence of a journal." });
        if (t.Type != TransactionType.Investment || t.UserId != request.UserId || t.PropertyId != request.PropertyId || t.Amount != request.Amount || t.Shares != request.Shares || t.Amount <= 0)
            return Conflict(new { message = "Independent reconciliation does not match the journal." });
        var source = await Source(t);
        if (!source.HasValue || (!await db.InvestmentApplications.AnyAsync(x => x.Id == source && x.UserId == t.UserId && x.PropertyId == t.PropertyId) &&
            !await db.Investments.AnyAsync(x => x.Id == source && x.UserId == t.UserId && x.PropertyId == t.PropertyId)))
            return Conflict(new { message = "Source record requires investigation. Financial correction remains blocked." });
        db.ActionLogs.Add(new ActionLog { UserId = User.GetUserId(), Action = "InvestmentIntentCommitVerified",
            Details = JsonSerializer.Serialize(new { operationId = id, sourceId = source, affectedUser = t.UserId, propertyId = t.PropertyId,
                amount = t.Amount, shares = t.Shares, reference = request.Reference, independentlyVerified = true, resolution = "retry_original_uuid" }) });
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return Ok(new { operationId = id, status = "commit_verified", retryOriginalUuid = true, canReset = false });
    }

    private async Task<Guid?> Source(UserTransaction t)
    {
        var logs = await db.ActionLogs.AsNoTracking().Where(x => x.Action == "ApplicateForInvestment" && x.UserId == t.UserId && x.Details.Contains(t.Id.ToString())).Select(x => x.Details).ToListAsync();
        foreach (var log in logs)
        {
            try {
                using var doc = JsonDocument.Parse(log); var j = doc.RootElement;
                if (j.GetProperty("transactionId").GetGuid() == t.Id && j.GetProperty("affectedUser").GetGuid() == t.UserId &&
                    j.GetProperty("propertyId").GetGuid() == t.PropertyId && j.GetProperty("amount").GetDecimal() == t.Amount &&
                    j.GetProperty("shares").GetInt32() == t.Shares && j.TryGetProperty("sourceId", out var source) && source.TryGetGuid(out var id)) return id;
            } catch (Exception e) when (e is JsonException or InvalidOperationException or KeyNotFoundException or FormatException) { }
        }
        return null;
    }
}
