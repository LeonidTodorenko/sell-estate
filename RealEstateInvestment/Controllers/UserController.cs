using FirebaseAdmin.Auth.Hash;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using System.ComponentModel.DataAnnotations;
using RealEstateInvestment.Services;
using Newtonsoft.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using RealEstateInvestment.Enums;
using Org.BouncyCastle.Asn1.Ocsp;

namespace RealEstateInvestment.Controllers
{ 
    [ApiController]
    [Authorize]
    [Route("api/users")]
    public class UserController : ControllerBase
    {

        private readonly AppDbContext _context;
        private readonly EmailService _emailService;
        private readonly IConfiguration _config;
        private readonly CaptchaService _captchaService;

        public UserController(AppDbContext context, EmailService emailService, IConfiguration config, CaptchaService captchaService)
        {
            _context = context;
            _emailService = emailService;
            _config = config;
            _captchaService = captchaService;
        }
        
        // Get list of users (admin only)
        [HttpGet]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _context.Users.ToListAsync();
            return Ok(users);
        }

        // Confirm KYC
        [HttpPost("{id}/verify-kyc")]
        public async Task<IActionResult> VerifyKYC(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "Пользователь не найден" });

            user.KycStatus = "verified";

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = id,
                Action = "VerifyKYC",
                Details = "User KYC verified"
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = "KYC подтверждён" });
        }

        // Block user
        [HttpPost("{id}/block")]
        public async Task<IActionResult> ToggleBlockUser(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found" });

            user.IsBlocked = !user.IsBlocked;
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = id,
                Action = user.IsBlocked ? "BlockUser" : "UnblockUser",
                Details = user.IsBlocked ? "User blocked" : "User unblocked"
            });

            await _context.SaveChangesAsync();

            return Ok(new { message = user.IsBlocked ? "User blocked" : "User unblocked" });
        }

        // todo подумать
        //[HttpPost("{id}/block")]
        //public async Task<IActionResult> ToggleBlockUser(Guid id)
        //{
        //    var user = await _context.Users.FindAsync(id);
        //    if (user == null) return NotFound();

        //    user.IsBlocked = !user.IsBlocked;
        //    await _context.SaveChangesAsync();

        //    return Ok(new { message = user.IsBlocked ? "User blocked" : "User unblocked" });
        //}

        // Unblock user
        [HttpPost("{id}/unblock")]
        public async Task<IActionResult> UnblockUser(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "Пользователь не найден" });

            user.IsBlocked = false;
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = id,
                Action = "UnblockUser",
                Details = "User manually unblocked"
            });
            await _context.SaveChangesAsync();
            return Ok(new { message = "Пользователь разблокирован" });
        }

        // Change user role (investor / admin)
        [HttpPost("{id}/change-role")]
        public async Task<IActionResult> ChangeUserRole(Guid id, [FromBody] string role)
        {
            if (role != "investor" && role != "admin")
                return BadRequest(new { message = "Неверная роль" });

            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "Пользователь не найден" });

            user.Role = role;
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = id,
                Action = "ChangeRole",
                Details = $"Role changed to {role}"
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = "Роль изменена" });
        }

        // all users
        [HttpGet("all")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _context.Users
                .OrderBy(u => u.FullName)
                .ToListAsync();

            return Ok(users);
        }
         
        // place some money to wallet
        [HttpPost("wallet/topup")]
        public async Task<IActionResult> TopUp([FromBody] TopUpRequest req)
        {
            var user = await _context.Users.FindAsync(req.UserId);
            if (user == null)
                return NotFound(new { message = "User not found" });

            if (!string.IsNullOrEmpty(user.PinCode))
            {
                if (req.PinOrPassword != user.PinCode)
                    return BadRequest(new { message = "Invalid PIN" });
            }
            else
            {
                if (req.PinOrPassword != user.PasswordHash) // TODO: hash check
                    return BadRequest(new { message = "Invalid password" });
            }

            user.WalletBalance += req.Amount;

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = req.UserId,
                Action = "TopUp",
                Details = $"Wallet topped up on {req.Amount} USD"
            });

            _context.UserTransactions.Add(new UserTransaction
            {
                Id = Guid.NewGuid(),
                UserId = req.UserId,
                Type = TransactionType.Deposit,
                Amount = req.Amount,
                Timestamp = DateTime.UtcNow,
                Notes = $"Wallet topped up on {req.Amount} USD"
            });

            await _context.SaveChangesAsync();

            return Ok(new { message = "Balance updated" });
        }

        // todo move
        public class TopUpRequest
        {
            public Guid UserId { get; set; }
            public decimal Amount { get; set; }
            public string PinOrPassword { get; set; }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetUserById(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
                return NotFound(new { message = "User not found" });

            return Ok(user);
        }
         
        [HttpGet("{userId}/total-assets")]
        public async Task<IActionResult> GetTotalAssets(Guid userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound(new { message = "User not found" });

            var totalInvested = await (
                from i in _context.Investments
                join p in _context.Properties on i.PropertyId equals p.Id
                where i.UserId == userId && i.Shares > 0
                select new
                {
                    i.Shares,
                    p.Price,
                    ShareValue = p.Price / p.TotalShares  
                }
            ).ToListAsync();

            decimal investmentValue = totalInvested.Sum(x => x.ShareValue * x.Shares);
            decimal wallet = user.WalletBalance;

            return Ok(new
            {
                walletBalance = wallet,
                investmentValue,
                totalAssets = wallet + investmentValue
            });
        }
         
        // todo move
        public class UpdateProfileRequest
        {
            public string FullName { get; set; }
            public string? PhoneNumber { get; set; }
            public string? Address { get; set; }
            public string? Email { get; set; }
            //public string? AvatarBase64 { get; set; }
        }

        [HttpPost("{id}/update-profile")]
        public async Task<IActionResult> UpdateProfile(Guid id, [FromBody] UpdateProfileRequest req)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
                return NotFound(new { message = "User not found" });

            if (!string.IsNullOrWhiteSpace(req.Email) && !req.Email.Equals(user.Email, StringComparison.OrdinalIgnoreCase))
            {
                var emailExists = await _context.Users
                    .AnyAsync(u => u.Email.ToLower() == req.Email.ToLower() && u.Id != id);
                if (emailExists)
                {
                    return BadRequest(new { message = "Email already in use by another user" });
                }

                user.Email = req.Email;
            }

            user.FullName = req.FullName;
            user.PhoneNumber = req.PhoneNumber;
            user.Address = req.Address;

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = id,
                Action = "UpdateProfile",
                Details = $"Profile updated: {req.FullName}; {req.PhoneNumber}; {req.Email}; {req.Address}"
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = "Profile updated" });
        }
         
        // todo move
        public class ChangePasswordRequest
        {
            public string CurrentPassword { get; set; }
            public string NewPassword { get; set; }
        }

        [HttpPost("{id}/change-password")]
        public async Task<IActionResult> ChangePassword(Guid id, [FromBody] ChangePasswordRequest req)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found" });

            if (user.PasswordHash != req.CurrentPassword) // todo check hash
                return BadRequest(new { message = "Invalid current password" });

            user.PasswordHash = req.NewPassword; // todo add hash
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = id,
                Action = "ChangePassword",
                Details = "Password changed"
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password changed" });
        }

        [HttpPost("{id}/upload-avatar")]
        public async Task<IActionResult> UploadAvatar(Guid id, [FromBody] AvatarRequest request)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            if (string.IsNullOrEmpty(request.Base64Image))
                return BadRequest(new { message = "No image provided" });

            user.AvatarBase64 = request.Base64Image;
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = id,
                Action = "UploadAvatar",
                Details = "Avatar uploaded"
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Avatar updated" });
        }
         
        // todo move
        public class AvatarRequest
        {
            public string Base64Image { get; set; }
        }

            [HttpGet("transactions/user/{userId}")]
            public async Task<IActionResult> GetUserTransactions(Guid userId,
                                                                [FromQuery] TransactionType? type,
                                                                [FromQuery] DateTime? from,
                                                                [FromQuery] DateTime? to)
            {
                var query = _context.UserTransactions
                    .Where(t => t.UserId == userId);

            if (type.HasValue)
                query = query.Where(t => t.Type == type.Value);

            if (from.HasValue)
                    query = query.Where(t => t.Timestamp >= from.Value);

                if (to.HasValue)
                    query = query.Where(t => t.Timestamp <= to.Value);

            var list = await query
                          .OrderByDescending(t => t.Timestamp)
                          .Select(t => new
                          {
                              t.Id,
                              t.Type,
                              t.Amount,
                              t.Shares,
                              t.PropertyId,
                              t.PropertyTitle,
                              t.Timestamp,
                              t.Notes
                          })
                          .ToListAsync();

            return Ok(list);
            }

        // google
        //[HttpPost("register")]
        //public async Task<IActionResult> Register([FromBody] ProfileRegisterRequest req)
        //{
        //    if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
        //        return BadRequest(new { message = "Email and password are required" });

        //    var existing = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == req.Email.ToLower());
        //    if (existing != null)
        //        return BadRequest(new { message = "Email already in use" });

        //    if (!await VerifyCaptcha(req.CaptchaToken)) {
        //        return BadRequest(new { message = "Captcha verification failed. Please try again. " });
        //    }

        //    var user = new User
        //    {
        //        FullName = req.FullName,
        //        Email = req.Email,
        //        PasswordHash = req.Password, // TODO: hash password
        //        SecretWord = req.SecretWord
        //    };

        //    _context.Users.Add(user);
        //    _context.ActionLogs.Add(new ActionLog
        //    {
        //        UserId = user.Id,
        //        Action = "Register",
        //        Details = "New user registered"
        //    });


        //    var token = Guid.NewGuid().ToString();

        //    _context.EmailConfirmationTokens.Add(new EmailConfirmationToken
        //    {
        //        UserId = user.Id,
        //        Token = token,
        //        CreatedAt = DateTime.UtcNow,
        //        ExpiresAt = DateTime.UtcNow.AddHours(24)
        //    });

        //    var confirmUrl = $"https://sell-estate.onrender.com/api/user/confirm-email?token={token}"; // todo set to add conf- frontend-URL  

        //    await _emailService.SendEmailAsync(user.Email, "Confirm your email",
        //        $"<h2>Welcome!</h2><p>Please confirm your email: <a href='{confirmUrl}'>Confirm Email</a></p>");

        //    await _emailService.SendToAdminAsync(
        //        "New user registered",
        //        $"A new user has registered: <strong>{user.FullName}</strong> ({user.Email})"
        //    );


        //    await _context.SaveChangesAsync();

        //    return Ok(new { message = "User registered successfully" });
        //}

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] ProfileRegisterRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return BadRequest(new { message = "Email and password are required" });

            var existing = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == req.Email.ToLower());
            if (existing != null)
                return BadRequest(new { message = "Email already in use" });

            if (!_captchaService.Verify(req.CaptchaId, req.CaptchaAnswer))
            {
                return BadRequest(new { message = "Captcha verification failed. Please try again." });
            }

            if (!string.IsNullOrWhiteSpace(req.PinCode) && !Regex.IsMatch(req.PinCode, @"^\d{4}$"))
                return BadRequest(new { message = "PIN code must be exactly 4 digits" });

            var user = new User
            {
                FullName = req.FullName,
                Email = req.Email,
                PasswordHash = req.Password, // TODO: hash password
                SecretWord = req.SecretWord,
                PinCode = req.PinCode
            };

            _context.Users.Add(user);
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = user.Id,
                Action = "Register",
                Details = "New user registered"
            });

            var token = Guid.NewGuid().ToString();

            _context.EmailConfirmationTokens.Add(new EmailConfirmationToken
            {
                UserId = user.Id,
                Token = token,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(24)
            });

            var confirmUrl = $"https://sell-estate.onrender.com/api/user/confirm-email?token={token}";

            await _emailService.SendEmailAsync(user.Email, "Confirm your email",
                $"<h2>Welcome!</h2><p>Please confirm your email: <a href='{confirmUrl}'>Confirm Email</a></p>");

            await _emailService.SendToAdminAsync(
                "New user registered",
                $"A new user has registered: <strong>{user.FullName}</strong> ({user.Email})"
            );

            await _context.SaveChangesAsync();

            return Ok(new { message = "User registered successfully" });
        }

        // todo разобраться с гугл капчей
        private async Task<bool> VerifyCaptcha(string token)
        {
            var client = new HttpClient();
            var secret = "пока убрал"; // todo mobe to config  _config["Recaptcha:SecretKey"];
            var response = await client.PostAsync(
                $"https://www.google.com/recaptcha/api/siteverify?secret={secret}&response={token}", null);
            var json = await response.Content.ReadAsStringAsync();
            dynamic result = JsonConvert.DeserializeObject(json);
            return result.success == true && result.score >= 0.5;
        }

        // todo move
        public class ProfileRegisterRequest
        {

            [Required]
            public string FullName { get; set; }

            [Required]
            [EmailAddress]
            public string Email { get; set; }

            [Required, MinLength(6)]
            public string Password { get; set; }

            [Required]
            public string SecretWord { get; set; }

            [Required]
            public string? PinCode { get; set; }

            [Required]
            public Guid CaptchaId { get; set; }

            [Required]
            public int CaptchaAnswer { get; set; }

            // todo google
            //[Required]
            //public string CaptchaToken { get; set; }
        }

        [HttpGet("confirm-email")]
        public async Task<IActionResult> ConfirmEmail([FromQuery] string token)
        {
            var tokenEntry = await _context.EmailConfirmationTokens
                .FirstOrDefaultAsync(t => t.Token == token && t.ExpiresAt > DateTime.UtcNow);

            if (tokenEntry == null)
                return BadRequest(new { message = "Invalid or expired token" });

            var user = await _context.Users.FindAsync(tokenEntry.UserId);
            if (user == null)
                return NotFound();

            user.IsEmailConfirmed = true;

            _context.EmailConfirmationTokens.Remove(tokenEntry); //delete token after use
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = user.Id,
                Action = "ConfirmEmail",
                Details = "User confirmed email"
            });

            await _context.SaveChangesAsync();

            return Ok(new { message = "Email confirmed!" });
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] string email)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null) return NotFound(new { message = "User not found" });

            var token = new PasswordResetToken
            {
                UserId = user.Id
            };
            _context.PasswordResetTokens.Add(token);

            var resetUrl = $"https://sell-estate.onrender.com/reset-password?token={token.Token}"; // todo move to config
            await _emailService.SendEmailAsync(email, "Reset Password",
                $"Click here to reset your password: <a href='{resetUrl}'>Reset Password</a>");

            await _context.SaveChangesAsync();
            return Ok(new { message = "Password reset link sent to email" });
        }

        public class ResetPasswordRequest
        {
            public string Token { get; set; }
            public string NewPassword { get; set; }
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
        {
            var tokenEntry = await _context.PasswordResetTokens
                .FirstOrDefaultAsync(t => t.Token == req.Token && t.ExpiresAt > DateTime.UtcNow);

            if (tokenEntry == null)
                return BadRequest(new { message = "Invalid or expired token" });

            var user = await _context.Users.FindAsync(tokenEntry.UserId);
            if (user == null)
                return NotFound(new { message = "User not found" });

            user.PasswordHash = req.NewPassword; // todo: hash
            _context.PasswordResetTokens.Remove(tokenEntry);
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = user.Id,
                Action = "ResetPassword",
                Details = "User reset their password"
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = "Password has been reset" });
        }

    }
}
