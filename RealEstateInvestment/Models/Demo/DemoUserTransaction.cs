using RealEstateInvestment.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RealEstateInvestment.Models
{
    public class DemoUserTransaction
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid DemoUserId { get; set; }

        public TransactionType Type { get; set; }

        public decimal Amount { get; set; }

        public int? Shares { get; set; }

        public Guid? PropertyId { get; set; }

        public string? PropertyTitle { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public string? Notes { get; set; }

        [ForeignKey(nameof(DemoUserId))]
        public DemoUser DemoUser { get; set; } = null!;

        [ForeignKey(nameof(PropertyId))]
        public Property? Property { get; set; }
    }
}