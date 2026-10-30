namespace RealEstateInvestment.Models;

// Immutable quote and settlement; legacy storage is retained for existing payment history.
public sealed class WalletPayment
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid RequestKey { get; set; }
    public decimal Amount { get; set; }
    public decimal WalletAmount { get; set; }
    public string ChargeCurrency { get; set; } = "RUB";
    public string WalletCurrency { get; set; } = "USD";
    public decimal ExchangeRate { get; set; }
    public decimal FeeAmount { get; set; }
    public bool IsTest { get; set; } = true;
    public string Method { get; set; } = "yookassa";
    public string? SettlementReference { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string ShopId { get; set; } = "";
    public string ReturnUrl { get; set; } = "";
    public string? ProviderId { get; set; }
    public string? ConfirmationUrl { get; set; }
    public string Status { get; set; } = "creating";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CreditedAt { get; set; }
}
