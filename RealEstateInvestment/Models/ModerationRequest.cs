namespace RealEstateInvestment.Models
{
    public enum ModerationStatus : short
    {
        Pending = 0,
        Approved = 1,
        Rejected = 2
    }

    public enum ChangeTarget : short
    {
        Property = 1,
        // в будущем: User, PaymentPlan, и т.д.
    }

    public class ModerationRequest
    {
        public Guid Id { get; set; }

        public ChangeTarget Target { get; set; }              // Property
        public Guid TargetId { get; set; }                    // Property.Id

        public string Field { get; set; } = default!;         // "Price" (или "RealPrice" и т.п.)
        public string OldValue { get; set; } = default!;      // сериализуем в строку/JSON
        public string NewValue { get; set; } = default!;

        public ModerationStatus Status { get; set; } = ModerationStatus.Pending;

        public Guid RequestedBy { get; set; }
        public DateTime RequestedAt { get; set; } = DateTime.UtcNow;

        public Guid? ReviewedBy { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? ReviewerComment { get; set; }

        // Анти-дубликат: отпечаток значения
        public string? Fingerprint { get; set; } // hash(Target, Field, NewValue)
    }

}
