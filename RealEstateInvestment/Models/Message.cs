using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class Message
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public string Title { get; set; }

        public string Content { get; set; }

        public Guid? RecipientId { get; set; } // null = for all users

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsRead { get; set; } = false;
    }
}
