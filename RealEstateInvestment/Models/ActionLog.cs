namespace RealEstateInvestment.Models
{
    public class ActionLog
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public string Action { get; set; } // "Login", "TopUp", "ApplyInvestment", "Logout"
        public string Details { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
