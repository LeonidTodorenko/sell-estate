using System;
using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class WithdrawalRequest
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid UserId { get; set; }

        [Required]
        public decimal Amount { get; set; }

        [Required]
        public string Status { get; set; } = "pending"; // pending, approved, rejected

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
