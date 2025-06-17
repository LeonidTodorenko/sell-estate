using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class InvestmentApplication
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid UserId { get; set; }

        [Required]
        public Guid PropertyId { get; set; }

        [Required]
        public decimal RequestedAmount { get; set; }

        [Required]
        public int RequestedShares { get; set; }

        public int? ApprovedShares { get; set; } // nullable, пока не подтверждена

        public decimal? ApprovedAmount { get; set; }

        public string Status { get; set; } = "pending"; // pending, accepted, partial, rejected, carried

        public bool IsPriority { get; set; } = false;

        public int StepNumber { get; set; } = 1; // по умолчанию первый платеж

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
