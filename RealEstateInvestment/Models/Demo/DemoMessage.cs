using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RealEstateInvestment.Models
{
    public class DemoMessage
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public string Title { get; set; } = string.Empty;

        public string Content { get; set; } = string.Empty;

        /// <summary>
        /// null можно использовать для template/global demo message.
        /// Обычно здесь будет конкретный DemoUserId.
        /// </summary>
        public Guid? DemoRecipientId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsRead { get; set; }

        [ForeignKey(nameof(DemoRecipientId))]
        public DemoUser? DemoRecipient { get; set; }
    }
}