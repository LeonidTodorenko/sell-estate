﻿using Microsoft.AspNetCore.Authorization;
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
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later,
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
             
            var exists = await _context.FcmDeviceTokens.FirstOrDefaultAsync(t => t.Token == request.Token);  //_context.FcmDeviceTokens.AnyAsync(t => t.Token == request.Token);

            if (exists == null)
            {
                _context.FcmDeviceTokens.Add(new FcmDeviceToken
                {
                    UserId = userId,
                    Token = request.Token
                });
            }
            else if (exists.UserId != userId)
            {
                // token is used by other user - update
                exists.UserId = userId;
                exists.UpdatedAt = DateTime.UtcNow;
            }

            //if (!exists)
            //{
            //    _context.FcmDeviceTokens.Add(new FcmDeviceToken
            //    {
            //        UserId = userId,
            //        Token = request.Token
            //    });

            //    await _context.SaveChangesAsync();
            //}
         
          
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
