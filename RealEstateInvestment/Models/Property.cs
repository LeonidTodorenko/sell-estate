using System;
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
        public int TotalShares { get; set; } // Количество доступных долей

        public int AvailableShares { get; set; }

        [Required]
        public string Status { get; set; } = "available"; // available, sold, rented

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
