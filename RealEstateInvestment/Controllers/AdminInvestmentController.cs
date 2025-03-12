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
    [Route("api/admin/investments")]
    public class AdminInvestmentController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminInvestmentController(AppDbContext context)
        {
            _context = context;
        }

        // ✅ Получить список всех инвестиций
        [HttpGet]
        public async Task<IActionResult> GetAllInvestments()
        {
            var investments = await _context.Investments.ToListAsync();
            return Ok(investments);
        }

        // ✅ Одобрить инвестицию
        [HttpPost("{id}/approve")]
        public async Task<IActionResult> ApproveInvestment(Guid id)
        {
            var investment = await _context.Investments.FindAsync(id);
            if (investment == null) return NotFound(new { message = "Инвестиция не найдена" });

            // Тут можно добавить логику подтверждения платежа
            await _context.SaveChangesAsync();
            return Ok(new { message = "Инвестиция одобрена" });
        }

        // ✅ Отклонить инвестицию
        [HttpPost("{id}/reject")]
        public async Task<IActionResult> RejectInvestment(Guid id)
        {
            var investment = await _context.Investments.FindAsync(id);
            if (investment == null) return NotFound(new { message = "Инвестиция не найдена" });

            _context.Investments.Remove(investment);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Инвестиция отклонена" });
        }
    }
}
