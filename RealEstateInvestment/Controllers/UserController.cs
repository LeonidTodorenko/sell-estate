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

        // ✅ Получить список пользователей (только для админа)
        [HttpGet]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _context.Users.ToListAsync();
            return Ok(users);
        }

        // ✅ Подтвердить KYC
        [HttpPost("{id}/verify-kyc")]
        public async Task<IActionResult> VerifyKYC(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "Пользователь не найден" });

            user.KycStatus = "verified";
            await _context.SaveChangesAsync();
            return Ok(new { message = "KYC подтверждён" });
        }

        // ✅ Заблокировать пользователя
        [HttpPost("{id}/block")]
        public async Task<IActionResult> BlockUser(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "Пользователь не найден" });

            user.IsBlocked = true;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Пользователь заблокирован" });
        }

        // ✅ Разблокировать пользователя
        [HttpPost("{id}/unblock")]
        public async Task<IActionResult> UnblockUser(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "Пользователь не найден" });

            user.IsBlocked = false;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Пользователь разблокирован" });
        }

        // ✅ Изменить роль пользователя (инвестор / админ)
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

        [HttpGet("all")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _context.Users
                .OrderBy(u => u.FullName)
                .ToListAsync();

            return Ok(users);
        }

        [HttpPost("{id}/block")]
        public async Task<IActionResult> ToggleBlockUser(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.IsBlocked = !user.IsBlocked;
            await _context.SaveChangesAsync();

            return Ok(new { message = user.IsBlocked ? "User blocked" : "User unblocked" });
        }
    }
}
