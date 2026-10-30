using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Services;

public sealed class PaymentOptions
{
    public bool Enabled { get; set; }
    public string ShopId { get; set; } = "";
    public string SecretKey { get; set; } = "";
    public string ReturnUrl { get; set; } = "";
    public string MobileReturnUrl { get; set; } = "ownersclub://payments/return";
    // A simulation, never a live FX quote. Set explicitly before enabling.
    public decimal ChargeUnitsPerWalletUnit { get; set; }
    public bool TestMode { get; set; } = true;
    public string ChargeCurrency { get; set; } = "RUB";
    public string WalletCurrency { get; set; } = "USD";
    public decimal FeePercent { get; set; }
    public decimal MinAmount { get; set; } = 1;
    public decimal MaxAmount { get; set; } = 10000;
    public string BankInstructions { get; set; } = "";
    // Separate explicit opt-in; never enabled by the test deployment configuration.
    public bool AllowLivePayments { get; set; }
    public bool Ready => Enabled &&
        (TestMode ? ShopId == "1514010" && SecretKey.StartsWith("test_") :
            AllowLivePayments && !string.IsNullOrWhiteSpace(ShopId) && ShopId != "1514010" && SecretKey.StartsWith("live_")) &&
        ChargeCurrency == "RUB" && WalletCurrency == "USD" && ChargeUnitsPerWalletUnit > 0 &&
        FeePercent >= 0 && FeePercent < 100 && MinAmount >= 1 && MaxAmount >= MinAmount && MaxAmount <= 10000 &&
        Uri.TryCreate(ReturnUrl, UriKind.Absolute, out var uri) &&
        (uri.Scheme == "https" || (uri.Scheme == "http" && uri.IsLoopback));
}

public sealed record VerifiedPayment(string Id, string Status, bool Test, bool Paid,
    string ShopId, decimal Amount, string Currency, Guid Correlation, string? ConfirmationUrl);

public interface IYooKassaPayments
{
    Task<VerifiedPayment> Create(WalletPayment payment, CancellationToken ct);
    Task<VerifiedPayment> Get(string id, CancellationToken ct);
}

public sealed class YooKassaPaymentClient(HttpClient http, IOptions<PaymentOptions> settings) : IYooKassaPayments
{
    private async Task<VerifiedPayment> Send(HttpMethod method, string path, object? body, string? key, CancellationToken ct)
    {
        var o = settings.Value;
        if (!o.Ready) throw new InvalidOperationException("Payment settings are unavailable");
        using var request = new HttpRequestMessage(method, "https://api.yookassa.ru/v3/" + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes(o.ShopId + ":" + o.SecretKey)));
        if (key != null) request.Headers.Add("Idempotence-Key", key);
        if (body != null) request.Content = JsonContent.Create(body);
        using var response = await http.SendAsync(request, ct);
        // Never include provider bodies or authorization in exceptions/logs.
        if (!response.IsSuccessStatusCode) throw new HttpRequestException("Payment provider request failed", null, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var r = json.RootElement;
        return new(r.GetProperty("id").GetString()!, r.GetProperty("status").GetString()!,
            r.GetProperty("test").GetBoolean(), r.GetProperty("paid").GetBoolean(),
            r.GetProperty("recipient").GetProperty("account_id").GetString()!,
            decimal.Parse(r.GetProperty("amount").GetProperty("value").GetString()!, CultureInfo.InvariantCulture),
            r.GetProperty("amount").GetProperty("currency").GetString()!,
            Guid.Parse(r.GetProperty("metadata").GetProperty("ownersclub_payment_id").GetString()!),
            r.TryGetProperty("confirmation", out var c) && c.TryGetProperty("confirmation_url", out var u) ? u.GetString() : null);
    }
    public Task<VerifiedPayment> Create(WalletPayment p, CancellationToken ct) => Send(HttpMethod.Post, "payments", new
    {
        amount = new { value = p.Amount.ToString("F2", CultureInfo.InvariantCulture), currency = p.ChargeCurrency },
        capture = true,
        confirmation = new { type = "redirect", return_url = p.ReturnUrl },
        description = "OwnersClub wallet top-up",
        metadata = new { ownersclub_payment_id = p.Id.ToString() }
    }, p.Id.ToString(), ct);
    public Task<VerifiedPayment> Get(string id, CancellationToken ct) => Send(HttpMethod.Get, "payments/" + Uri.EscapeDataString(id), null, null, ct);
}

public sealed class PaymentService(AppDbContext db, IYooKassaPayments gateway, IOptions<PaymentOptions> options)
{
    public async Task<WalletPayment> Create(Guid user, Guid key, decimal amount, CancellationToken ct, string method = "yookassa", string client = "web")
    {
        var o = options.Value;
        if (!o.Ready) throw new InvalidOperationException("Sandbox payments are disabled");
        if (key == Guid.Empty || amount < o.MinAmount || amount > o.MaxAmount || decimal.Round(amount, 2) != amount ||
            method is not ("yookassa" or "invoice" or "bank_transfer" or "assistance") || client is not ("web" or "android"))
            throw new ArgumentException("Use a request UUID and 1–10000 RUB with at most two decimals");
        var p = await db.Set<WalletPayment>().SingleOrDefaultAsync(x => x.UserId == user && x.RequestKey == key, ct);
        if (p != null && (p.Amount != amount || p.Method != method)) throw new ArgumentException("Request key already belongs to another amount");
        if (p == null)
        {
            p = new() { Id = Guid.NewGuid(), UserId = user, RequestKey = key, Amount = amount,
                WalletAmount = decimal.Round((amount - decimal.Round(amount * o.FeePercent / 100, 2, MidpointRounding.AwayFromZero)) / o.ChargeUnitsPerWalletUnit, 2, MidpointRounding.ToZero),
                FeeAmount = decimal.Round(amount * o.FeePercent / 100, 2, MidpointRounding.AwayFromZero),
                ChargeCurrency = o.ChargeCurrency, WalletCurrency = o.WalletCurrency,
                ExchangeRate = o.ChargeUnitsPerWalletUnit, IsTest = o.TestMode, Method = method,
                Status = method == "yookassa" ? "creating" : "requested",
                ShopId = o.ShopId, ReturnUrl = client == "android" ? o.MobileReturnUrl : o.ReturnUrl };
            if (client == "android" && o.MobileReturnUrl != "ownersclub://payments/return")
                throw new InvalidOperationException("Mobile return URL is not configured");
            if (p.WalletAmount <= 0) throw new ArgumentException("Amount is below the simulated credit minimum");
            db.Add(p);
            await db.SaveChangesAsync(ct); // durable idempotence key BEFORE calling provider
        }
        if (p.Method != "yookassa" || p.ProviderId != null) return p;
        // After provider's 24-hour idempotence window, never silently create a second charge.
        if (p.CreatedAt < DateTime.UtcNow.AddHours(-23)) throw new InvalidOperationException("Payment requires manual reconciliation");
        var remote = await gateway.Create(p, ct);
        Validate(p, remote);
        if (remote.ConfirmationUrl is { } url && (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            uri.Scheme != "https" || !(uri.Host == "yookassa.ru" || uri.Host.EndsWith(".yookassa.ru") || uri.Host == "yoomoney.ru" || uri.Host.EndsWith(".yoomoney.ru"))))
            throw new InvalidOperationException("Unexpected sandbox confirmation URL");
        // Conditional update avoids a stale create response overwriting webhook settlement.
        await db.Set<WalletPayment>().Where(x => x.Id == p.Id && x.ProviderId == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ProviderId, remote.Id)
                .SetProperty(x => x.Status, remote.Status).SetProperty(x => x.ConfirmationUrl, remote.ConfirmationUrl), ct);
        await db.Entry(p).ReloadAsync(ct);
        return p;
    }

    public static void Validate(WalletPayment p, VerifiedPayment r)
    {
        if (r.Test != p.IsTest || r.ShopId != p.ShopId || r.Currency != p.ChargeCurrency || r.Amount != p.Amount ||
            r.Correlation != p.Id || string.IsNullOrEmpty(r.Id) || (p.ProviderId != null && p.ProviderId != r.Id))
            throw new InvalidOperationException("Sandbox payment verification failed");
    }

    public async Task Reconcile(Guid id, string providerId, CancellationToken ct)
    {
        if (!options.Value.Ready) throw new InvalidOperationException("Sandbox payments are disabled");
        var p = await db.Set<WalletPayment>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (p == null || p.Method != "yookassa") return;
        var r = await gateway.Get(providerId, ct); // payload status/amount are never trusted
        Validate(p, r);
        if (r.Id != providerId) throw new InvalidOperationException("Provider ID mismatch");
        if (r.Status != "succeeded" && r.Status != "canceled") return;
        if (r.Status == "succeeded" && !r.Paid) throw new InvalidOperationException("Unpaid successful payment");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // Database compare-and-set wins once across workers, duplicate requests and webhook retries.
        var won = await db.Set<WalletPayment>().Where(x => x.Id == id && x.CreditedAt == null && x.Status != "canceled")
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, r.Status)
                .SetProperty(x => x.ProviderId, r.Id)
                .SetProperty(x => x.CreditedAt, r.Status == "succeeded" ? DateTime.UtcNow : (DateTime?)null), ct);
        if (won == 1 && r.Status == "succeeded")
        {
            var changed = await db.Users.Where(x => x.Id == p.UserId)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.WalletBalance, x => x.WalletBalance + p.WalletAmount), ct);
            if (changed != 1) throw new InvalidOperationException("Wallet account missing");
            db.UserTransactions.Add(new() { Id = p.Id, UserId = p.UserId, Type = TransactionType.Deposit,
                Amount = p.WalletAmount, Timestamp = DateTime.UtcNow, Notes = "Wallet top-up; payment " + p.Id + (p.IsTest ? "; TEST" : "") });
            db.ActionLogs.Add(new() { Id = p.Id, UserId = p.UserId, Action = "PaymentDeposit",
                Details = JsonSerializer.Serialize(new { paymentId = p.Id, providerId = r.Id, amount = p.Amount, chargeCurrency = p.ChargeCurrency, fee = p.FeeAmount,
                    walletAmount = p.WalletAmount, walletCurrency = p.WalletCurrency, rate = p.ExchangeRate,
                    conversionRoundingAmount = p.Amount - p.FeeAmount - p.WalletAmount * p.ExchangeRate, test = p.IsTest }) });
            await db.SaveChangesAsync(ct);
        }
        await tx.CommitAsync(ct);
    }
}
