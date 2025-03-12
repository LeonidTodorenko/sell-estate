using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class RentalIncome
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid PropertyId { get; set; }

        [Required]
        public Guid InvestorId { get; set; }

        [Required]
        public decimal Amount { get; set; } // Сумма выплаты

        public DateTime PayoutDate { get; set; } = DateTime.UtcNow;
    }
}
