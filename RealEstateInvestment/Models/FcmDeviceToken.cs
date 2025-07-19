using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class FcmDeviceToken
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid UserId { get; set; }

        [Required]
        public string Token { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
