using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RealEstateInvestment.Models
{
    public class DemoShareOfferBid
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid DemoOfferId { get; set; }

        [Required]
        public Guid DemoBidderId { get; set; }

        [Required]
        public decimal BidPricePerShare { get; set; }

        public int Shares { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(DemoOfferId))]
        public DemoShareOffer DemoOffer { get; set; } = null!;

        [ForeignKey(nameof(DemoBidderId))]
        public DemoUser DemoBidder { get; set; } = null!;
    }
}