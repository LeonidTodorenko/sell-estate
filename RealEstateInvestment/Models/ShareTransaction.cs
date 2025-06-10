using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class ShareTransaction
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();

        public Guid BuyerId { get; set; }
        public Guid SellerId { get; set; }
        public Guid PropertyId { get; set; }
        public Property Property { get; set; }

        public int Shares { get; set; }
        public decimal PricePerShare { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

}
