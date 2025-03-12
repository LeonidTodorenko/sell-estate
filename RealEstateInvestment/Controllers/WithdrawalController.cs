using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/withdrawals")]
    public class WithdrawalController : ControllerBase
    {
        private readonly AppDbContext _context;

        public WithdrawalController(AppDbContext context)
        {
            _context = context;
        }

        // ✅ Инвестор подаёт заявку на вывод средств
        [HttpPost("request")]
        public async Task<IActionResult> RequestWithdrawal([FromBody] WithdrawalRequest request)
        {
            var user = await _context.Users.FindAsync(request.UserId);
            if (user == null) return NotFound(new { message = "Пользователь не найден" });

            if (request.Amount <= 0 || request.Amount > user.WalletBalance)
                return BadRequest(new { message = "Недостаточно средств" });

            user.WalletBalance -= request.Amount;
            _context.WithdrawalRequests.Add(request);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Заявка на вывод подана" });
        }

        // ✅ Администратор подтверждает вывод
        [HttpPost("{id}/approve")]
        public async Task<IActionResult> ApproveWithdrawal(Guid id)
        {
            var request = await _context.WithdrawalRequests.FindAsync(id);
            if (request == null) return NotFound(new { message = "Заявка не найдена" });

            request.Status = "approved";
            await _context.SaveChangesAsync();

            return Ok(new { message = "Вывод одобрен" });
        }

        // ✅ Администратор отклоняет вывод
        [HttpPost("{id}/reject")]
        public async Task<IActionResult> RejectWithdrawal(Guid id)
        {
            var request = await _context.WithdrawalRequests.FindAsync(id);
            if (request == null) return NotFound(new { message = "Заявка не найдена" });

            var user = await _context.Users.FindAsync(request.UserId);
            if (user != null)
            {
                user.WalletBalance += request.Amount; // Возвращаем деньги
            }

            request.Status = "rejected";
            await _context.SaveChangesAsync();

            return Ok(new { message = "Вывод отклонён" });
        }
    }
}
