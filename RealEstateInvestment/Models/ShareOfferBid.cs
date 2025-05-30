using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class ShareOfferBid
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();

        [Required] public Guid OfferId { get; set; }
        [ForeignKey("OfferId")] public ShareOffer Offer { get; set; }

        [Required] public Guid BidderId { get; set; }

        [Required] public decimal BidPricePerShare { get; set; }

        public int Shares { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

}
