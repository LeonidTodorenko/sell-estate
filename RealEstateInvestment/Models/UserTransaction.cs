using RealEstateInvestment.Enums;

namespace RealEstateInvestment.Models
{
    public class UserTransaction
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public TransactionType Type { get; set; } 
        public decimal Amount { get; set; }  
        public int? Shares { get; set; } 
        public Guid? PropertyId { get; set; }
        public string? PropertyTitle { get; set; }
        public DateTime Timestamp { get; set; }
        public string? Notes { get; set; }

        public User User { get; set; }
    }

}
