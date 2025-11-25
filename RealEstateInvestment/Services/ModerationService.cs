using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Services
{
    // todo проверить
    public interface IModerationService
    {
        Task<ModerationRequest> CreateOrReturnPendingAsync(
            ChangeTarget target, Guid targetId,
            string field, string oldValue, string newValue,
            Guid requestedBy);

        Task<bool> ApproveAsync(Guid requestId, Guid reviewerId, string? comment = null);
        Task<bool> RejectAsync(Guid requestId, Guid reviewerId, string? comment = null);
    }

    public class ModerationService : IModerationService
    {
        private readonly AppDbContext _db;
        private readonly ILogger<ModerationService> _log;

        public ModerationService(AppDbContext db, ILogger<ModerationService> log)
        {
            _db = db; _log = log;
        }

        private static string Fingerprint(ChangeTarget t, Guid id, string field, string newValue)
            => Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(
                   System.Text.Encoding.UTF8.GetBytes($"{t}|{id}|{field}|{newValue}")));

        public async Task<ModerationRequest> CreateOrReturnPendingAsync(
            ChangeTarget target, Guid targetId, string field,
            string oldValue, string newValue, Guid requestedBy)
        {
            var fp = Fingerprint(target, targetId, field, newValue);

            var existing = await _db.ModerationRequests
                .FirstOrDefaultAsync(x => x.Target == target
                                       && x.TargetId == targetId
                                       && x.Field == field
                                       && x.Status == ModerationStatus.Pending
                                       && x.Fingerprint == fp);
            if (existing != null) return existing;

            var req = new ModerationRequest
            {
                Id = Guid.NewGuid(),
                Target = target,
                TargetId = targetId,
                Field = field,
                OldValue = oldValue,
                NewValue = newValue,
                Status = ModerationStatus.Pending,
                RequestedBy = requestedBy,
                Fingerprint = fp
            };

            _db.ModerationRequests.Add(req);
            // аудит можно писать в ActionLogs
            await _db.SaveChangesAsync();
            return req;
        }

        public async Task<bool> ApproveAsync(Guid requestId, Guid reviewerId, string? comment = null)
        {
            var r = await _db.ModerationRequests.FirstOrDefaultAsync(x => x.Id == requestId);
            if (r == null || r.Status != ModerationStatus.Pending) return false;

            // Применяем изменения
            if (r.Target == ChangeTarget.Property)
            {
                var prop = await _db.Properties.FirstOrDefaultAsync(p => p.Id == r.TargetId);
                if (prop == null) return false;

                switch (r.Field)
                {
                    case "Price":
                        if (decimal.TryParse(r.NewValue, out var newPrice))
                        {
                            prop.Price = newPrice;
                            // при желании синхронизируем TotalShares/share price, если у вас связана логика
                        }
                        break;

                        // здесь легко масштабируется:
                        // case "RealPrice": ...
                        // case "MonthlyRentalIncome": ...
                }
            }

            r.Status = ModerationStatus.Approved;
            r.ReviewedBy = reviewerId;
            r.ReviewedAt = DateTime.UtcNow;
            r.ReviewerComment = comment;

            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RejectAsync(Guid requestId, Guid reviewerId, string? comment = null)
        {
            var r = await _db.ModerationRequests.FirstOrDefaultAsync(x => x.Id == requestId);
            if (r == null || r.Status != ModerationStatus.Pending) return false;

            r.Status = ModerationStatus.Rejected;
            r.ReviewedBy = reviewerId;
            r.ReviewedAt = DateTime.UtcNow;
            r.ReviewerComment = comment;

            await _db.SaveChangesAsync();
            return true;
        }
    }

}
