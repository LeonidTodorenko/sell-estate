using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RealEstateInvestment.Models
{
    public class DemoKycDocument
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid DemoUserId { get; set; }

        [Required]
        public string Type { get; set; } = "passport";

        [Required]
        public string Base64File { get; set; } = string.Empty;

        public string Status { get; set; } = "approved";

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(DemoUserId))]
        public DemoUser DemoUser { get; set; } = null!;
    }
}