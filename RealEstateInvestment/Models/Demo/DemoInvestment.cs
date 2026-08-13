using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RealEstateInvestment.Models
{
    public class DemoInvestment
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid DemoUserId { get; set; }

        [Required]
        public Guid PropertyId { get; set; }

        [Required]
        public int Shares { get; set; }

        [Required]
        public decimal InvestedAmount { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(DemoUserId))]
        public DemoUser DemoUser { get; set; } = null!;

        // Property остаётся production/read-only сущностью.
        [ForeignKey(nameof(PropertyId))]
        public Property Property { get; set; } = null!;
    }
}