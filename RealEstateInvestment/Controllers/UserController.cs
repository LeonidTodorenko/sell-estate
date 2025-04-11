using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
 
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



    }
}
