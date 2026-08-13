using RealEstateInvestment.Enums;
using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class DemoUser
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(64)]
        public string DemoCode { get; set; } = null!;

        [Required]
        public string FullName { get; set; } = "Demo Investor";

        [Required, EmailAddress]
        public string Email { get; set; } = null!;

        // Понадобится позже, когда подключим полноценный demo login.
        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        public string SecretWord { get; set; } = string.Empty;

        public string Role { get; set; } = "investor";

        public UserRole UserRole { get; set; }

        public PermissionFlags Permissions { get; set; } = PermissionFlags.None;

        public string KycStatus { get; set; } = "verified";

        public bool IsBlocked { get; set; }

        public decimal WalletBalance { get; set; }

        public string? PhoneNumber { get; set; }

        public string? Address { get; set; }

        public string? AvatarBase64 { get; set; }

        public bool IsEmailConfirmed { get; set; } = true;

        public string ClientNumber { get; set; } = null!;

        public DateTime? TermsAcceptedAt { get; set; }

        public string? TermsVersion { get; set; }

        public DateTime? KycContractSentAt { get; set; }

        public string? KycContractVersion { get; set; }

        [RegularExpression(
            @"^\d{4}$",
            ErrorMessage = "PIN code must be exactly 4 digits")]
        public string? PinCode { get; set; }

        /// <summary>
        /// Единственный эталонный аккаунт,
        /// из которого клонируются новые sandbox users.
        /// Этому пользователю нельзя выдавать обычный login.
        /// </summary>
        public bool IsTemplate { get; set; }

        /// <summary>
        /// Можно отключить demo account,
        /// не удаляя его историю.
        /// </summary>
        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastActiveAt { get; set; }

        /// <summary>
        /// Можно использовать для автоматической очистки
        /// давно заброшенных demo accounts.
        /// Template сюда не привязываем.
        /// </summary>
        public DateTime? ExpiresAt { get; set; }

        public bool? IsDeleted { get; set; }

        public DateTime? DeletedAt { get; set; }
    }
}