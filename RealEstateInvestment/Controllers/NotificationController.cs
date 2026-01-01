using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using System.Security.Claims;
using RealEstateInvestment.Helpers;

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
                UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later,
                Action = "MarkAsRead",
                Details = "Mark As Read id: " + id.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Notification read" });
        }

        [HttpPost("register-token")]
        public async Task<IActionResult> RegisterToken([FromBody] TokenRequest request)
        {
            var userId = User.GetUserId();
            if (userId == Guid.Empty) return Unauthorized();

            // Ищем запись с таким токеном (если уже есть)
            var existingToken = await _context.FcmDeviceTokens
                .FirstOrDefaultAsync(t => t.Token == request.Token);

            if (existingToken != null)
            {
                // Если токен уже есть, но принадлежит другому пользователю — обновляем
                if (existingToken.UserId != userId)
                {
                    existingToken.UserId = userId;
                    existingToken.UpdatedAt = DateTime.UtcNow;
                }
                // Если уже есть и принадлежит этому же пользователю — ничего не делаем
            }
            else
            {
                // Добавляем новый токен
                _context.FcmDeviceTokens.Add(new FcmDeviceToken
                {
                    UserId = userId,
                    Token = request.Token,
                    CreatedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();
            return Ok();
        }
         
        public class TokenRequest
        {
            public string Token { get; set; }
        }

        //[HttpGet("test-email")]
        //public async Task<IActionResult> TestEmail([FromServices] EmailService emailService)
        //{
        //    await emailService.SendEmailAsync("your@email.com", "Тест письма", "<b>Письмо отправлено успешно</b>");
        //    return Ok("Done");
        //}
    }
}
