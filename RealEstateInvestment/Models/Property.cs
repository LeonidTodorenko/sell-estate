using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class Property
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public string Title { get; set; }

        [Required]
        public string Location { get; set; }

        [Required]
        public decimal Price { get; set; }

        [Required]
        public int TotalShares { get; set; }

        public int AvailableShares { get; set; }

        [Required]
        public string Status { get; set; } = "available"; // available, sold, rented

        // 🔹 Payment Plan (новые поля)
        public decimal UpfrontPayment { get; set; }  // Первоначальный взнос
        public DateTime ApplicationDeadline { get; set; } // Срок подачи заявок
        public Guid? PriorityInvestorId { get; set; } // Инвестор с правом выкупа

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public decimal MonthlyRentalIncome { get; set; } = 0; // Доход в месяц
        public DateTime LastPayoutDate { get; set; } = DateTime.UtcNow; // Дата последней выплаты

    }
}
