using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RealEstateInvestment.Models
{
    public class DemoInvestmentApplication
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid DemoUserId { get; set; }

        [Required]
        public Guid PropertyId { get; set; }

        [Required]
        public decimal RequestedAmount { get; set; }

        [Required]
        public int RequestedShares { get; set; }

        public int? ApprovedShares { get; set; }

        public decimal? ApprovedAmount { get; set; }

        public string Status { get; set; } = "pending";

        public bool IsPriority { get; set; }

        public int StepNumber { get; set; } = 1;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(DemoUserId))]
        public DemoUser DemoUser { get; set; } = null!;

        [ForeignKey(nameof(PropertyId))]
        public Property Property { get; set; } = null!;
    }
}