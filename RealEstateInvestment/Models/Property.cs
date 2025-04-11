using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class Property
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public string Title { get; set; }

        [Required]
        public string Location { get; set; }

        [Required]
        public decimal Price { get; set; }

        [Required]
        public int TotalShares { get; set; }

        public int AvailableShares { get; set; }

        [Required]
        public string Status { get; set; } = "pending"; // pending, available, sold, rented

        [Required]
        public string ListingType { get; set; } = "sale";

        public string? ImageBase64 { get; set; }

        public DateTime? ExpectedCompletionDate { get; set; }

        // 🔹 Payment Plan 
        public decimal UpfrontPayment { get; set; }  // Initial payment
        public DateTime ApplicationDeadline { get; set; } // Application deadline
        public Guid? PriorityInvestorId { get; set; } // The investor has the right to redeem

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public decimal MonthlyRentalIncome { get; set; } = 0; // Income per month
        public DateTime LastPayoutDate { get; set; } = DateTime.UtcNow; // Last payment date
         
        // map
        public double Latitude { get; set; }
        public double Longitude { get; set; }

    }
}
