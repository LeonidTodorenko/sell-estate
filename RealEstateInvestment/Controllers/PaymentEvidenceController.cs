using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;

namespace RealEstateInvestment.Controllers;

[ApiController, Authorize, Route("api/payments/{paymentId:guid}/evidence")]
public sealed class PaymentEvidenceController(AppDbContext db, IOptions<PaymentOptions> options) : ControllerBase
{
    public const int MaxBytes = 5 * 1024 * 1024;
    private async Task<bool> Admin() => await FinancialAdminAttribute.IsCurrentAdminAsync(User, db,
        HttpContext.RequestServices.GetRequiredService<IConfiguration>());

    private async Task<WalletPayment?> Accessible(Guid id) => await db.Payments.AsNoTracking()
        .SingleOrDefaultAsync(p => p.Id == id && (p.UserId == User.GetUserId() || User.IsInRole("admin")));

    private async Task<IActionResult?> Guard(Guid id)
    {
        if (User.IsDemo()) return Forbid();
        if (await FinancialActor.ValidateAsync(User, db) is {} error) return error;
        var p = await Accessible(id);
        if (p == null) return NotFound();
        if (p.UserId != User.GetUserId() && !await Admin()) return Forbid();
        return null;
    }

    [HttpGet]
    public async Task<IActionResult> List(Guid paymentId)
    {
        if (await Guard(paymentId) is {} error) return error;
        Response.Headers.CacheControl = "no-store";
        return Ok(await db.Set<PaymentEvidence>().AsNoTracking().Where(e => e.PaymentId == paymentId)
            .OrderBy(e => e.CreatedAt).ThenBy(e => e.Id)
            .Select(e => new { e.Id, e.AuthorId, e.Kind, e.Comment, e.ContentType,
                size = e.Content == null ? 0 : e.Content.Length, e.Sha256, e.CreatedAt }).ToListAsync());
    }

    [HttpGet("{id:guid}/file")]
    public async Task<IActionResult> Download(Guid paymentId, Guid id)
    {
        if (await Guard(paymentId) is {} error) return error;
        var e = await db.Set<PaymentEvidence>().AsNoTracking().SingleOrDefaultAsync(e => e.PaymentId == paymentId && e.Id == id);
        if (e?.Content == null) return NotFound();
        Response.Headers.CacheControl = "no-store";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Content-Security-Policy"] = "sandbox; default-src 'none'";
        var extension = e.ContentType == "application/pdf" ? "pdf" : e.ContentType == "image/png" ? "png" : "jpg";
        return File(e.Content, e.ContentType!, $"evidence-{e.Id:N}.{extension}");
    }

    // Multipart only; bounded before buffering. No caller-supplied path or filename is stored.
    [HttpPost, RequestSizeLimit(MaxBytes + 16384), RequestFormLimits(MultipartBodyLengthLimit = MaxBytes + 16384)]
    public async Task<IActionResult> Submit(Guid paymentId, [FromForm] string? comment, IFormFile? file, CancellationToken ct)
    {
        if (await Guard(paymentId) is {} error) return error;
        var p = (await Accessible(paymentId))!;
        if (p.UserId != User.GetUserId()) return Forbid();
        comment = comment?.Trim() ?? "";
        if (comment.Length > 2000 || (comment.Length == 0 && file == null)) return BadRequest();
        byte[]? content = null;
        string? mime = null;
        if (file != null)
        {
            if (file.Length <= 0 || file.Length > MaxBytes) return BadRequest(new { message = "Maximum file size is 5 MiB." });
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream, ct);
            content = stream.ToArray();
            mime = Detect(content);
            if (mime == null || mime != file.ContentType.ToLowerInvariant())
                return BadRequest(new { message = "Only matching PDF, JPEG or PNG files are accepted." });
        }
        return await Append(p, new PaymentEvidence { Id = Guid.NewGuid(), PaymentId = paymentId,
            AuthorId = User.GetUserId(), Comment = comment, Content = content, ContentType = mime,
            Sha256 = content == null ? null : Convert.ToHexString(SHA256.HashData(content)) }, ct);
    }

    public sealed record ClarificationRequest(string Comment);
    [HttpPost("clarification"), Authorize(Roles = "admin")]
    public async Task<IActionResult> Clarify(Guid paymentId, ClarificationRequest request, CancellationToken ct)
    {
        if (await Guard(paymentId) is {} error) return error;
        if (!await Admin()) return Forbid();
        var comment = request.Comment?.Trim();
        if (string.IsNullOrEmpty(comment) || comment.Length > 2000) return BadRequest();
        return await Append((await Accessible(paymentId))!, new PaymentEvidence { Id = Guid.NewGuid(),
            PaymentId = paymentId, AuthorId = User.GetUserId(), Kind = "clarification", Comment = comment }, ct);
    }

    private async Task<IActionResult> Append(WalletPayment p, PaymentEvidence entry, CancellationToken ct)
    {
        if (!p.IsTest || !options.Value.TestMode || p.Method == "yookassa") return Conflict(new { message = "Evidence workflow is available for TEST manual requests only." });
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // Locks the existing request before counting or inserting; races with settlement serialize here.
        var won = await db.Payments.Where(x => x.Id == p.Id && x.CreditedAt == null &&
                (x.Status == "requested" || x.Status == "processing"))
            .ExecuteUpdateAsync(u => u.SetProperty(x => x.UpdatedAt, DateTime.UtcNow), ct);
        if (won != 1) return Conflict(new { message = "Request is already closed." });
        var entries = db.Set<PaymentEvidence>().Where(e => e.PaymentId == p.Id);
        if (await entries.CountAsync(ct) >= 50 || (entry.Content != null && await entries.CountAsync(e => e.Content != null, ct) >= 5))
            return Conflict(new { message = "Limit: 5 files and 50 history entries per request." });
        db.Add(entry);
        db.ActionLogs.Add(new() { Id = Guid.NewGuid(), UserId = User.GetUserId(), Action = "PaymentEvidence",
            Details = JsonSerializer.Serialize(new { paymentId = p.Id, evidenceId = entry.Id, entry.Kind, entry.Sha256, size = entry.Content?.Length ?? 0 }) });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Ok(new { entry.Id });
    }

    internal static string? Detect(byte[] b)
    {
        if (b.Length >= 12 && b.AsSpan(0, 8).SequenceEqual(new byte[] {137,80,78,71,13,10,26,10}) && b.AsSpan(8,4).SequenceEqual(new byte[] {0,0,0,13})) return "image/png";
        if (b.Length >= 4 && b[0] == 255 && b[1] == 216 && b[2] == 255 && b[^2] == 255 && b[^1] == 217) return "image/jpeg";
        if (b.Length >= 12 && b.AsSpan(0,5).SequenceEqual("%PDF-"u8) && System.Text.Encoding.ASCII.GetString(b.AsSpan(Math.Max(0,b.Length-1024))).Contains("%%EOF")) return "application/pdf";
        return null;
    }
}
