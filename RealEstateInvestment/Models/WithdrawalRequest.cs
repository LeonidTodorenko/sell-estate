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
        public string Status { get; set; } = "pending"; // pending, approved, rejected, canceled

        public Guid? RequestKey { get; set; }
        public string? TestDestination { get; set; }
        public string? RejectionReason { get; set; }
        public Guid? ProcessedBy { get; set; }
        public DateTime? ProcessedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
