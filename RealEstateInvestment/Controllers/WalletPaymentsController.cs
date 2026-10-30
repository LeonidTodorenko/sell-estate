using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Services;

namespace RealEstateInvestment.Controllers;

[ApiController]
[Route("api/payments")]
public sealed class WalletPaymentsController(AppDbContext db, PaymentService service,
    IOptions<PaymentOptions> settings) : ControllerBase
{
    [Authorize, HttpGet("config")]
    public IActionResult Config() { var o=settings.Value; return Ok(new { enabled=o.Ready&&!User.IsDemo(),
        chargeCurrency=o.ChargeCurrency, walletCurrency=o.WalletCurrency, exchangeRate=o.ChargeUnitsPerWalletUnit,
        feePercent=o.FeePercent, minAmount=o.MinAmount, maxAmount=o.MaxAmount, testMode=o.TestMode,
        methods=new[]{"yookassa","invoice","bank_transfer","assistance"}, bankInstructions=o.BankInstructions }); }

    public sealed record CreateRequest(Guid RequestKey, decimal Amount, string Method = "yookassa", string Client = "web");
    [Authorize, HttpPost]
    public async Task<IActionResult> Create(CreateRequest request, CancellationToken ct)
    {
        if (User.IsDemo()) return Forbid();
        if (await FinancialActor.ValidateAsync(User, db) is { } error) return error;
        if (!settings.Value.Ready) return StatusCode(503, new { message = "Payments are unavailable" });
        try { return Ok(View(await service.Create(User.GetUserId(), request.RequestKey, request.Amount, ct, request.Method, request.Client))); }
        catch (ArgumentException e) { return Conflict(new { message = e.Message }); }
        catch (DbUpdateException) { return Conflict(new { message = "Retry with the same request key" }); }
        catch (Exception e) when (e is HttpRequestException or InvalidOperationException or JsonException or FormatException or TaskCanceledException)
        { return StatusCode(503, new { message = "Payment result is uncertain. Retry with the same request key." }); }
    }

    [Authorize, HttpGet("{id:guid}")]
    public async Task<IActionResult> Status(Guid id, CancellationToken ct)
    {
        if (User.IsDemo()) return Forbid();
        if (await FinancialActor.ValidateAsync(User, db) is { } error) return error;
        var p = await db.Payments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.UserId == User.GetUserId(), ct);
        if (p == null) return NotFound();
        // Return navigation never credits funds. Only authenticated API verification can settle.
        if (p.ProviderId != null)
        {
            try { await service.Reconcile(id, p.ProviderId, ct); }
            catch (Exception e) when (e is HttpRequestException or InvalidOperationException or JsonException or FormatException or TaskCanceledException)
            { return StatusCode(503, new { message = "Provider verification unavailable. Refresh later." }); }
        }
        return Ok(View(await db.Payments.AsNoTracking().SingleAsync(x => x.Id == id, ct)));
    }

    [AllowAnonymous, HttpPost("webhook"), HttpPost("yookassa-sandbox/webhook"), RequestSizeLimit(16384)]
    public async Task<IActionResult> Webhook([FromBody] JsonElement payload, CancellationToken ct)
    {
        if (!settings.Value.Ready) return StatusCode(503);
        if (payload.ValueKind != JsonValueKind.Object) return BadRequest();
        if (!payload.TryGetProperty("event", out var ev) || ev.ValueKind != JsonValueKind.String || ev.GetString() is not ("payment.succeeded" or "payment.canceled")) return Ok();
        if (!payload.TryGetProperty("object", out var obj) || obj.ValueKind != JsonValueKind.Object || !obj.TryGetProperty("id", out var pid) ||
            pid.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(pid.GetString()) || pid.GetString()!.Length > 100) return BadRequest();
        var providerId = pid.GetString()!;
        var id = await db.Payments.Where(x => x.ProviderId == providerId).Select(x => (Guid?)x.Id).SingleOrDefaultAsync(ct);
        // Handles a webhook arriving before create-payment response persistence.
        if (id == null && obj.TryGetProperty("metadata", out var meta) && meta.ValueKind == JsonValueKind.Object && meta.TryGetProperty("ownersclub_payment_id", out var hint) &&
            hint.ValueKind == JsonValueKind.String && Guid.TryParse(hint.GetString(), out var parsed)) id = parsed;
        if (id == null) return Ok();
        try { await service.Reconcile(id.Value, providerId, ct); return Ok(); }
        catch (Exception e) when (e is HttpRequestException or InvalidOperationException or JsonException or FormatException or TaskCanceledException or DbUpdateException)
        { return StatusCode(503); } // Let provider retry. No credential, body or exception logging.
    }

    [Authorize, HttpGet]
    public async Task<IActionResult> History(CancellationToken ct) {
        if(User.IsDemo())return Forbid();
        if(await FinancialActor.ValidateAsync(User,db) is {} error)return error;
        var rows=await db.Payments.AsNoTracking().Where(x=>x.UserId==User.GetUserId())
            .OrderByDescending(x=>x.CreatedAt).Take(100).ToListAsync(ct);
        return Ok(rows.Select(View));
    }

    private async Task<bool> IsCurrentAdmin(CancellationToken ct) => !User.IsDemo() &&
        await db.Users.AnyAsync(x=>x.Id==User.GetUserId() && x.Role=="admin" && x.IsEmailConfirmed && !x.IsBlocked && x.IsDeleted!=true,ct);

    [Authorize(Roles="admin"), HttpGet("admin/queue")]
    public async Task<IActionResult> Queue(CancellationToken ct) {
        if(!await IsCurrentAdmin(ct))return Forbid();
        var rows=await db.Payments.AsNoTracking().OrderByDescending(x=>x.CreatedAt).Take(100).ToListAsync(ct);
        return Ok(rows.Select(p=>new {payment=View(p),userId=p.UserId,reviewedBy=p.ReviewedBy}));
    }

    public sealed record ReviewRequest(string Action, string? Reference, bool FundsIndependentlyVerified=false, decimal? ReceivedAmount=null, string? ReceivedCurrency=null, string? PaymentLink=null);
    [Authorize(Roles="admin"), HttpPost("admin/{id:guid}/review")]
    public async Task<IActionResult> Review(Guid id, ReviewRequest request, CancellationToken ct) {
        if(!await IsCurrentAdmin(ct))return Forbid();
        if(!settings.Value.Ready)return StatusCode(503);
        var p=await db.Payments.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==id,ct);
        if(p==null)return NotFound();
        if(p.Method=="yookassa")return Conflict(new{message="Online payments settle only through provider verification."});
        if(request.Action is not ("processing" or "reject" or "confirm"))return BadRequest();
        var reference=request.Reference?.Trim().ToUpperInvariant();
        if(request.PaymentLink is {} link && (!Uri.TryCreate(link,UriKind.Absolute,out var uri) || uri.Scheme!="https" ||
            !(uri.Host=="yookassa.ru" || uri.Host.EndsWith(".yookassa.ru") || uri.Host=="yoomoney.ru" || uri.Host.EndsWith(".yoomoney.ru"))))return BadRequest();
        // Statement/reconciliation ID only; no user uploads or card fields are accepted.
        if(request.Action=="confirm" && (!request.FundsIndependentlyVerified || request.ReceivedAmount!=p.Amount || request.ReceivedCurrency!=p.ChargeCurrency || reference==null ||
            !System.Text.RegularExpressions.Regex.IsMatch(reference,@"^[A-Za-z][A-Za-z0-9_-]{7,79}$")))
            return BadRequest(new{message="Independently verify receipt and provide a unique statement reference starting with a letter (8–80 characters). Never enter card data."});
        if(p.Status=="succeeded")return request.Action=="confirm"&&p.SettlementReference==reference?Ok(View(p)):Conflict();
        if(p.Status=="rejected"||p.Status=="canceled")return Conflict();
        if(!await db.Users.AnyAsync(x=>x.Id==p.UserId && !x.IsBlocked && x.IsDeleted!=true && x.IsEmailConfirmed,ct))return Conflict();
        var next=request.Action=="confirm"?"succeeded":request.Action=="reject"?"rejected":"processing";
        try {
            await using var tx=await db.Database.BeginTransactionAsync(ct);
            var won=await db.Payments.Where(x=>x.Id==id && x.CreditedAt==null && (x.Status=="requested" || x.Status=="processing"))
                .ExecuteUpdateAsync(u=>u.SetProperty(x=>x.Status,next).SetProperty(x=>x.UpdatedAt,DateTime.UtcNow)
                    .SetProperty(x=>x.ReviewedBy,User.GetUserId())
                    .SetProperty(x=>x.ConfirmationUrl,request.PaymentLink ?? p.ConfirmationUrl)
                    .SetProperty(x=>x.SettlementReference,request.Action=="confirm"?reference:null)
                    .SetProperty(x=>x.CreditedAt,request.Action=="confirm"?DateTime.UtcNow:(DateTime?)null),ct);
            if(won!=1)return Conflict();
            if(request.Action=="confirm") {
                var changed=await db.Users.Where(x=>x.Id==p.UserId && !x.IsBlocked && x.IsDeleted!=true && x.IsEmailConfirmed)
                    .ExecuteUpdateAsync(u=>u.SetProperty(x=>x.WalletBalance,x=>x.WalletBalance+p.WalletAmount),ct);
                if(changed!=1)throw new InvalidOperationException("Account unavailable");
                db.UserTransactions.Add(new(){Id=p.Id,UserId=p.UserId,Type=Enums.TransactionType.Deposit,
                    Amount=p.WalletAmount,Timestamp=DateTime.UtcNow,Notes="Verified manual wallet deposit; payment "+p.Id+(p.IsTest?"; TEST":"")});
            }
            db.ActionLogs.Add(new(){Id=request.Action=="confirm"?p.Id:Guid.NewGuid(),UserId=User.GetUserId(),Action="PaymentReview",
                Details=JsonSerializer.Serialize(new{paymentId=id,beneficiary=p.UserId,status=next,reference,
                    amount=p.Amount,currency=p.ChargeCurrency,fee=p.FeeAmount,walletAmount=p.WalletAmount,
                    walletCurrency=p.WalletCurrency,rate=p.ExchangeRate,
                    conversionRoundingAmount=p.Amount-p.FeeAmount-p.WalletAmount*p.ExchangeRate,
                    test=p.IsTest,independentlyVerified=request.FundsIndependentlyVerified,receivedAmount=request.ReceivedAmount,receivedCurrency=request.ReceivedCurrency})});
            await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
        } catch(Exception e) when (e is DbUpdateException or System.Data.Common.DbException) {
            return Conflict(new{message="Reference already used or request changed. Reconcile before retrying."});
        }
        return Ok(View(await db.Payments.AsNoTracking().SingleAsync(x=>x.Id==id,ct)));
    }

    private static object View(Models.WalletPayment p) => new { id=p.Id, requestKey=p.RequestKey, amount=p.Amount,
        chargeCurrency=p.ChargeCurrency,walletAmount=p.WalletAmount,walletCurrency=p.WalletCurrency,
        feeAmount=p.FeeAmount,exchangeRate=p.ExchangeRate,
        conversionRoundingAmount=p.Amount-p.FeeAmount-p.WalletAmount*p.ExchangeRate,method=p.Method,status=p.Status,
        credited=p.CreditedAt!=null,confirmationUrl=p.ConfirmationUrl,testMode=p.IsTest,
        createdAt=p.CreatedAt,updatedAt=p.UpdatedAt,creditedAt=p.CreditedAt };
}
