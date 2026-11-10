namespace RealEstateInvestment.Models;

// Private DB storage: never served by static-file middleware or a public URL.
public sealed class PaymentEvidence
{
    public Guid Id { get; set; }
    public Guid PaymentId { get; set; }
    public WalletPayment Payment { get; set; } = null!;
    public Guid AuthorId { get; set; }
    public string Kind { get; set; } = "submission";
    public string Comment { get; set; } = "";
    public string? ContentType { get; set; }
    public byte[]? Content { get; set; }
    public string? Sha256 { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
