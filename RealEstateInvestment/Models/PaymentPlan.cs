using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class PaymentPlan
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid PropertyId { get; set; }

        [Required]
        public string Milestone { get; set; } = string.Empty;

        public DateTime? EventDate { get; set; }
        public DateTime DueDate { get; set; }

        public string InstallmentCode { get; set; } = string.Empty;

        public decimal Percentage { get; set; }

        [Required]
        public decimal AmountDue { get; set; }

        public decimal VAT { get; set; } = 0;

        [Required]
        public decimal Total { get; set; }

        public decimal Paid { get; set; } = 0;

        public decimal Outstanding => Total - Paid;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

}
