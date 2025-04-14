using FirebaseAdmin.Auth.Hash;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/users")]
    public class UserController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UserController(AppDbContext context)
        {
            _context = context;
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
            if (user == null) return NotFound();

            user.WalletBalance += req.Amount;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Balance updated" });
        }

        // todo move
        public class TopUpRequest
        {
            public Guid UserId { get; set; }
            public decimal Amount { get; set; }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetUserById(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
                return NotFound(new { message = "User not found" });

            return Ok(user);
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
            if (user == null) return NotFound(new { message = "User not found" });

            user.FullName = req.FullName;
            user.PhoneNumber = req.PhoneNumber;
            if (!string.IsNullOrWhiteSpace(req.Email))
            {
                user.Email = req.Email;
            }
            user.Address = req.Address;
            //if (!string.IsNullOrWhiteSpace(req.AvatarBase64)) {
            //    user.AvatarBase64 = req.AvatarBase64;
            //}
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
            await _context.SaveChangesAsync();

            return Ok(new { message = "Avatar updated" });
        }

        // todo move
        public class AvatarRequest
        {
            public string Base64Image { get; set; }
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return BadRequest(new { message = "Email and password are required" });

            var existing = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == req.Email.ToLower());
            if (existing != null)
                return BadRequest(new { message = "Email already in use" });

            var user = new User
            {
                FullName = req.FullName,
                Email = req.Email,
                PasswordHash = req.Password, // TODO: hash password
                SecretWord = req.SecretWord
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "User registered successfully" });
        }

        // todo move
        public class RegisterRequest
        {
            public string FullName { get; set; }
            public string Email { get; set; }
            public string Password { get; set; }
            public string SecretWord { get; set; }
        }


    }
}
