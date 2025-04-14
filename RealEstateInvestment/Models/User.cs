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
        public string PasswordHash { get; set; }

        [Required]
        public string SecretWord { get; set; }

        public string Role { get; set; } = "investor"; // investor, admin

        public string KycStatus { get; set; } = "pending"; // pending, verified, rejected

        public bool IsBlocked { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public decimal WalletBalance { get; set; } = 0;

        public string? PhoneNumber { get; set; }

        public string? Address { get; set; }

        public string? AvatarBase64 { get; set; }
    }
}
