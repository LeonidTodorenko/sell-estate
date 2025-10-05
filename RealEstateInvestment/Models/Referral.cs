namespace RealEstateInvestment.Models
{
    public class Referral
    {
        public Guid Id { get; set; }
        public Guid InviterUserId { get; set; }
        public Guid RefereeUserId { get; set; }
        public Guid? InviteId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
