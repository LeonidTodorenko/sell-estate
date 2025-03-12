using System;
using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class User
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public string FullName { get; set; }

        [Required, EmailAddress]
        public string Email { get; set; }

        [Required]
        public string Role { get; set; } = "investor"; // investor, admin

        public string? FirebaseUid { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        public string PasswordHash { get; set; }
    }
}
