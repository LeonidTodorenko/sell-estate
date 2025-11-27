using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Migrations;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using System.Security.Claims;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/referrals")]
    public class ReferralsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _cfg;
        private readonly ILogger<ReferralsController> _log;
        private readonly EmailService _email;
        private int InviteDays => int.TryParse(_cfg["Referral:InviteDays"], out var d) ? d : 5;
        private int DailyLimit => int.TryParse(_cfg["Referral:DailyInviteLimit"], out var n) ? n : 5;

        public ReferralsController(AppDbContext db, IConfiguration cfg, ILogger<ReferralsController> log, EmailService email)
        {
            _db = db;
            _cfg = cfg;
            _log = log;
            _email = email;
        }

        public class InviteRequest {
            public string Email { get; set; } = default!; 
        }

        //[AllowAnonymous]
        //[HttpGet("ping")]
        //public IActionResult Ping() => Ok(new { ok = true, at = DateTime.UtcNow });

        [HttpPost("invite")]
        public async Task<IActionResult> Invite([FromBody] InviteRequest req)
        {
            var inviterIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(inviterIdStr, out var inviterId))
                return Unauthorized();

            var email = (req.Email ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { message = "Email required" });

            // === DAILY LIMIT CHECK ===
            var today = DateTime.UtcNow.Date;
            var invitesToday = await _db.ReferralInvites
                .CountAsync(x =>
                    x.InviterUserId == inviterId &&
                    x.CreatedAt >= today &&
                    x.CreatedAt < today.AddDays(1));

            if (invitesToday >= DailyLimit)
            {
                return BadRequest(new
                {
                    message = $"Daily invite limit reached ({DailyLimit} per day)."
                });
            }

        

            // 1) Загружаем пользователя
            var inviter = await _db.Users.FindAsync(inviterId);
            if (inviter == null)
                return BadRequest(new { message = "User not found" });

            // 2) Считаем totalAssets так же, как в GetTotalAssets
            //    (можно вынести в общий сервис, но пока просто продублируем идею)
            decimal totalAssets = await CalculateTotalAssets(inviterId);

            if (totalAssets < 10_000m)
                return BadRequest(new { message = "Minimum total assets of 10 000 USD required to generate referral code." });

            // 3) Определяем реферальный % и срок по totalAssets
            var (rewardPercent, rewardYears) = UserFeeHelper.GetReferrerRewardByTotal(totalAssets);
            if (rewardPercent <= 0 || rewardYears <= 0)
                return BadRequest(new { message = "Referral reward not available for your tier." });

            // 4) Стоимость генерации кода = 10$
            const decimal CodeCost = 10m;
            if (inviter.WalletBalance < CodeCost)
                return BadRequest(new { message = "Not enough wallet balance to pay 10 USD for referral code." });

            inviter.WalletBalance -= CodeCost;

            _db.UserTransactions.Add(new UserTransaction
            {
                Id = Guid.NewGuid(),
                UserId = inviterId,
                Type = TransactionType.ReferralCodePurchase,
                Amount = CodeCost,
                Timestamp = DateTime.UtcNow,
                Notes = "Referral code generation fee 10 USD"
            });

            // 5) Генерим код, срок действия 24 часа
            var code = ReferralCode.Generate(8);
            var codeHash = ReferralCode.Hash(code);

            var invite = new ReferralInvite
            {
                Id = Guid.NewGuid(),
                InviterUserId = inviterId,
                InviteeEmail = email,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(InviteDays),// вместо InviteDays
                Status = ReferralInviteStatus.Pending,

                ReferrerRewardPercent = rewardPercent,
                ReferrerRewardYears = rewardYears
            };

            _db.ReferralInvites.Add(invite);

            var appBase = _cfg["App:PublicBaseUrl"] ?? "https://sell-estate.onrender.com"; // todo check
            var registerLink = $"https://todtech.ru/invite.html?code={Uri.EscapeDataString(code)}";  // todo $"{appBase}/register?ref={Uri.EscapeDataString(code)}";

            await _email.SendEmailAsync(
               email,
                "You're invited!",
                $@"<p>You were invited to RealEstate app.</p>
           <p><b>Referral code:</b> {code}</p>
           <p><a href=""{registerLink}"">Register with this link</a></p>
           <p>The code is valid until {invite.ExpiresAt:yyyy-MM-dd HH:mm} UTC.</p>"
            );

            _db.ActionLogs.Add(new ActionLog
            {
                UserId = inviterId,
                Action = "ReferralInvite",
                Details = $"Invited {email}, reward={rewardPercent:P}, years={rewardYears}, totalAssets={totalAssets}"
            });

            await _db.SaveChangesAsync();

            _log.LogInformation("Referral invite for {Email}: code={Code}", email, code);

            return Ok(new
            {
                id = invite.Id,
                inviteeEmail = invite.InviteeEmail,
                code = code,
                expiresAt = invite.ExpiresAt,
                status = invite.Status.ToString(),
                link = registerLink,
                rewardPercent,
                rewardYears
            });
        }
         
        [HttpGet("my-invites")]
        public async Task<IActionResult> MyInvites()
        {
            var inviterId = User.GetUserId();
            if (inviterId == Guid.Empty) return Unauthorized();

            var list = await _db.ReferralInvites
                .Where(x => x.InviterUserId == inviterId)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new
                {
                    id = x.Id,
                    inviteeEmail = x.InviteeEmail,
                    createdAt = x.CreatedAt,
                    expiresAt = x.ExpiresAt,
                    acceptedAt = x.AcceptedAt,
                    status = x.Status.ToString()
                })
                .ToListAsync();

            return Ok(list);
        }

        public class RedeemRequest { public string Code { get; set; } = default!; }

        // Для уже зарегистрированного пользователя: привязать код
        [HttpPost("redeem")]
        public async Task<IActionResult> Redeem([FromBody] RedeemRequest req)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userIdStr, out var userId)) return Unauthorized();

            var exists = await _db.Referrals.AnyAsync(r => r.RefereeUserId == userId);
            if (exists) return BadRequest(new { message = "Referrer already set" });

            var codeHash = ReferralCode.Hash((req.Code ?? "").Trim());
            var invite = await _db.ReferralInvites
                .Where(x => x.CodeHash == codeHash)
                .FirstOrDefaultAsync();

            if (invite == null || invite.Status != ReferralInviteStatus.Pending)
                return BadRequest(new { message = "Invalid referral code" });

            if (invite.ExpiresAt <= DateTime.UtcNow)
            {
                invite.Status = ReferralInviteStatus.RevokedOrExpired;
                await _db.SaveChangesAsync();
                return BadRequest(new { message = "Referral code expired" });
            }

            invite.AcceptedAt = DateTime.UtcNow;
            invite.RedeemedByUserId = userId;
            invite.Status = ReferralInviteStatus.Redeemed;

            _db.Referrals.Add(new Referral
            {
                Id = Guid.NewGuid(),
                InviterUserId = invite.InviterUserId,
                RefereeUserId = userId,
                InviteId = invite.Id,
                CreatedAt = DateTime.UtcNow,
                ReferrerRewardPercent = invite.ReferrerRewardPercent,
                RewardValidUntil = DateTime.UtcNow.AddYears(invite.ReferrerRewardYears)
            });

            await _db.SaveChangesAsync();
            return Ok(new { message = "Referral linked" });
        }


        private async Task<decimal> CalculateTotalAssets(Guid userId)
        {
            var user = await _db.Users.FindAsync(userId);
            if (user == null) return 0m;

            // investments
            var totalInvested = await (
                from i in _db.Investments
                join p in _db.Properties on i.PropertyId equals p.Id
                where i.UserId == userId && i.Shares > 0
                select new
                {
                    i.Shares,
                    p.Price,
                    p.TotalShares,
                    ShareValue = p.Price / p.TotalShares
                }
            ).ToListAsync();

            decimal investmentValue = totalInvested.Sum(x => x.ShareValue * x.Shares);

            // applications
            var pendingApplications = await (
                from a in _db.InvestmentApplications
                join p in _db.Properties on a.PropertyId equals p.Id
                where a.UserId == userId && a.Status == "pending"
                select new
                {
                    a.RequestedShares,
                    ShareValue = p.Price / p.TotalShares
                }
            ).ToListAsync();

            decimal pendingApplicationsValue = pendingApplications.Sum(x => x.ShareValue * x.RequestedShares);

            // offers on market
            var marketOffers = await (
                from o in _db.ShareOffers
                join p in _db.Properties on o.PropertyId equals p.Id
                where o.SellerId == userId && o.IsActive
                select new
                {
                    o.SharesForSale,
                    ShareValue = p.Price / p.TotalShares
                }
            ).ToListAsync();

            decimal marketValue = marketOffers.Sum(x => x.ShareValue * x.SharesForSale);

            // wallet
            decimal wallet = user.WalletBalance;

            // rental income можем включать/не включать по договорённости,
            // в ТЗ написано, что это тоже часть состояния
            // добавим его как накопленный доход  
            decimal totalAssets = wallet + investmentValue + pendingApplicationsValue + marketValue;

            return totalAssets;
        }
    }
}
