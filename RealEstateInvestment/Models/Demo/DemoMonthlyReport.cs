using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RealEstateInvestment.Models;

public sealed class DemoMonthlyReport
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid DemoUserId { get; set; }

    public DateTime ReportMonth { get; set; }

    public decimal WalletBalance { get; set; }

    public decimal InvestmentValue { get; set; }

    public decimal RentalIncome { get; set; }

    public decimal TotalCapital { get; set; }

    public decimal CapitalChange { get; set; }

    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(DemoUserId))]
    public DemoUser DemoUser { get; set; } = null!;
}
