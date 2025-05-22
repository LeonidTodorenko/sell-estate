using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class ShareOffer
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();

        [Required] public Guid InvestmentId { get; set; }
        [Required] public Guid SellerId { get; set; }

        public int SharesForSale { get; set; }
        public decimal PricePerShare { get; set; } // выставленная цена
        public DateTime ExpirationDate { get; set; }
        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

}
