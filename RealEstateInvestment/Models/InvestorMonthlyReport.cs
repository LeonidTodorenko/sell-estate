namespace RealEstateInvestment.Models;

// Same snapshot contract as DemoMonthlyReport, with a separate real investor owner.
public sealed class InvestorMonthlyReport
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public DateTime ReportMonth { get; set; }
    public decimal WalletBalance { get; set; }
    public decimal InvestmentValue { get; set; }
    public decimal RentalIncome { get; set; }
    public decimal TotalCapital { get; set; }
    public decimal CapitalChange { get; set; }
    public DateTime GeneratedAt { get; set; }
}
