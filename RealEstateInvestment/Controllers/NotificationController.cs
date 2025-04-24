using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;

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

        // Get user notifications
        [HttpGet("{userId}")]
        public async Task<IActionResult> GetNotifications(Guid userId)
        {
            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId)
                .ToListAsync();

            return Ok(notifications);
        }

        //Mark notification as read
        [HttpPost("{id}/read")]
        public async Task<IActionResult> MarkAsRead(Guid id)
        {
            var notification = await _context.Notifications.FindAsync(id);
            if (notification == null) return NotFound(new { message = "Notification not found" });

            notification.IsRead = true;
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later,
                Action = "MarkAsRead",
                Details = "Mark As Read id: " + id.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Notification read" });
        }

        //[HttpGet("test-email")]
        //public async Task<IActionResult> TestEmail([FromServices] EmailService emailService)
        //{
        //    await emailService.SendEmailAsync("your@email.com", "Тест письма", "<b>Письмо отправлено успешно</b>");
        //    return Ok("Done");
        //}
    }
}
