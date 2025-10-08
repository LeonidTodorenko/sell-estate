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
        private int InviteDays => int.TryParse(_cfg["Referral:InviteDays"], out var d) ? d : 7;
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
            if (!Guid.TryParse(inviterIdStr, out var inviterId)) return Unauthorized();

            var email = (req.Email ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { message = "Email required" });

            // простой лимит за 24 часа
            var dayAgo = DateTime.UtcNow.AddDays(-1);
            var sent = await _db.ReferralInvites.CountAsync(x =>
                x.InviterUserId == inviterId && x.CreatedAt >= dayAgo && x.Status == ReferralInviteStatus.Pending);
            if (sent >= DailyLimit)
                return BadRequest(new { message = "Invite limit reached. Try later." });

            var code = ReferralCode.Generate(8);
            var codeHash = ReferralCode.Hash(code);

            var invite = new ReferralInvite
            {
                Id = Guid.NewGuid(),
                InviterUserId = inviterId,
                InviteeEmail = email,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(InviteDays),
                Status = ReferralInviteStatus.Pending
            };

            _db.ReferralInvites.Add(invite);

            // письмо
            var appBase = _cfg["App:PublicBaseUrl"] ?? "https://sell-estate.onrender.com"; // todo check
            var registerLink = $"https://todtech.ru/invite.html?code={Uri.EscapeDataString(code)}"; // $"{appBase}/register?ref={Uri.EscapeDataString(code)}";

            await _email.SendEmailAsync(
               email,
                "You're invited!",
                $@"<p>You were invited to RealEstate app.</p>
                   <p><b>Referral code:</b> {code}</p>
                   <p><a href=""{registerLink}"">Register with this link</a></p>
                   <p>The code is valid until {invite.ExpiresAt:yyyy-MM-dd HH:mm} UTC.</p>"
            );

            // расскоментируем когда будет сайт или рабочая ссылка
       //     await _email.SendEmailAsync(
       //   email,
       //    "You're invited!",
       //    $@"<p>You were invited to RealEstate app.</p>
       //            <p><b>Referral code:</b> {code}</p>
       //            <p><a href=""{registerLink}"">Register with this link</a></p>
       //            <p>The code is valid until {invite.ExpiresAt:yyyy-MM-dd HH:mm} UTC.</p>"
       //);

            _db.ActionLogs.Add(new ActionLog
            {
                UserId = inviterId,
                Action = "ReferralInvite",
                Details = $"Invited {email}"
            });

            await _db.SaveChangesAsync();

            var appUrl = (_cfg["App:PublicBaseUrl"] ?? "").TrimEnd('/');
            var link = $"{appUrl}/register?code={code}";

            // TODO: здесь подключите ваш e-mail сервис. Пока просто лог:
            _log.LogInformation("Referral invite for {Email}: code={Code}, link={Link}", email, code, link);

            // В DEV можно вернуть код/ссылку прямо в ответе
//#if DEBUG
//            return Ok(new { message = "Invite created", code, link, expiresAt = invite.ExpiresAt });
//#else
//            return Ok(new { message = "Invite created", expiresAt = invite.ExpiresAt });
//#endif

            return Ok(new
            {
                id = invite.Id,
                inviteeEmail = invite.InviteeEmail,
                code = code,
                expiresAt = invite.ExpiresAt,
                status = invite.Status.ToString(),
                link = registerLink
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
                InviteId = invite.Id
            });

            await _db.SaveChangesAsync();
            return Ok(new { message = "Referral linked" });
        }
    }
}
