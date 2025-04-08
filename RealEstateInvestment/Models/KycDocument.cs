using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class KycDocument
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid UserId { get; set; }

        [Required]
        public string Type { get; set; } = "passport"; // passport, iban, etc.

        [Required]
        public string Base64File { get; set; }

        public string Status { get; set; } = "pending"; // pending, approved, rejected

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}
