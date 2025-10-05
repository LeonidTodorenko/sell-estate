using RealEstateInvestment.Enums;

namespace RealEstateInvestment.Models
{
    public class ReferralInvite
    {
        public Guid Id { get; set; }
        public Guid InviterUserId { get; set; }
        public string InviteeEmail { get; set; } = default!;
        public string CodeHash { get; set; } = default!;
        public DateTime ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? AcceptedAt { get; set; }
        public Guid? RedeemedByUserId { get; set; }
        public ReferralInviteStatus Status { get; set; } = ReferralInviteStatus.Pending;
    }
}
