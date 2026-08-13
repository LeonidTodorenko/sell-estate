using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RealEstateInvestment.Models
{
    public class DemoShareTransaction
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid DemoBuyerId { get; set; }

        public Guid DemoSellerId { get; set; }

        public Guid PropertyId { get; set; }

        public int Shares { get; set; }

        public decimal PricePerShare { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(DemoBuyerId))]
        public DemoUser DemoBuyer { get; set; } = null!;

        [ForeignKey(nameof(DemoSellerId))]
        public DemoUser DemoSeller { get; set; } = null!;

        [ForeignKey(nameof(PropertyId))]
        public Property Property { get; set; } = null!;
    }
}