namespace RealEstateInvestment.Models
{
    public class Referral
    {
        public Guid Id { get; set; }
        public Guid InviterUserId { get; set; }
        public Guid RefereeUserId { get; set; }
        public Guid? InviteId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public decimal ReferrerRewardPercent { get; set; }     // фиксируем на момент регистрации
        public DateTime RewardValidUntil { get; set; }         // CreatedAt + N лет
    }


}
