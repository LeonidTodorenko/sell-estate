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
    [Route("api/notifications")]
    public class NotificationController : ControllerBase
    {
        private readonly AppDbContext _context;

        public NotificationController(AppDbContext context)
        {
            _context = context;
        }

        // ✅ Получить уведомления пользователя
        [HttpGet("{userId}")]
        public async Task<IActionResult> GetNotifications(Guid userId)
        {
            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId)
                .ToListAsync();

            return Ok(notifications);
        }

        // ✅ Отметить уведомление как прочитанное
        [HttpPost("{id}/read")]
        public async Task<IActionResult> MarkAsRead(Guid id)
        {
            var notification = await _context.Notifications.FindAsync(id);
            if (notification == null) return NotFound(new { message = "Уведомление не найдено" });

            notification.IsRead = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Уведомление прочитано" });
        }
    }
}
