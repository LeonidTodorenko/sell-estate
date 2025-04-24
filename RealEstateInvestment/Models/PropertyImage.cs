using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class PropertyImage
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid PropertyId { get; set; }

        [Required]
        public string Base64Data { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

}
