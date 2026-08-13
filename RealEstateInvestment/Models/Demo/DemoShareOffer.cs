using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RealEstateInvestment.Models
{
    public class DemoShareOffer
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid DemoSellerId { get; set; }

        [Required]
        public Guid PropertyId { get; set; }

        /// <summary>
        /// Из какой demo-инвестиции выставлены shares.
        /// Нужен для корректного cancel/buy/sell позже.
        /// </summary>
        public Guid? DemoInvestmentId { get; set; }

        public int SharesForSale { get; set; }

        public decimal LockedInvestedAmount { get; set; }

        public decimal StartPricePerShare { get; set; }

        public decimal? BuyoutPricePerShare { get; set; }

        public DateTime ExpirationDate { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(DemoSellerId))]
        public DemoUser DemoSeller { get; set; } = null!;

        [ForeignKey(nameof(PropertyId))]
        public Property Property { get; set; } = null!;

        [ForeignKey(nameof(DemoInvestmentId))]
        public DemoInvestment? DemoInvestment { get; set; }

        public List<DemoShareOfferBid> Bids { get; set; } = new();
    }
}