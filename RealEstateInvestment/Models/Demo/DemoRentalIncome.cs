using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RealEstateInvestment.Models
{
    public class DemoRentalIncome
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid PropertyId { get; set; }

        [Required]
        public Guid DemoInvestorId { get; set; }

        [Required]
        public decimal Amount { get; set; }

        public DateTime PayoutDate { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// UTC calendar month represented by its first day at 00:00:00.
        /// Used as the persisted idempotency key for scheduled demo payouts.
        /// </summary>
        public DateTime PayoutMonth { get; set; } = new(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        [ForeignKey(nameof(DemoInvestorId))]
        public DemoUser DemoInvestor { get; set; } = null!;

        [ForeignKey(nameof(PropertyId))]
        public Property Property { get; set; } = null!;
    }
}
