using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using RealEstateInvestment.Helpers;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/messages")]
    public class MessageController : ControllerBase
    {
        private readonly AppDbContext _context;

        public MessageController(AppDbContext context)
        {
            _context = context;
        }

        // Receiving user messages
        [HttpGet("inbox/{userId}")]
        public async Task<IActionResult> GetInbox(Guid userId)
        {
            if (User.IsDemo())
            {
                userId = User.ResolveRequestedUserId(userId);
                if (userId == Guid.Empty) return Unauthorized();
                var demoMessages = await _context.DemoMessages.AsNoTracking()
                    .Where(m => m.DemoRecipientId == null || m.DemoRecipientId == userId)
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => new { m.Id, m.Title, m.Content, RecipientId = m.DemoRecipientId, m.CreatedAt, m.IsRead })
                    .ToListAsync();
                return Ok(demoMessages);
            }

            var messages = await _context.Messages
                .Where(m => m.RecipientId == null || m.RecipientId == userId)
                .OrderByDescending(m => m.CreatedAt)
                .ToListAsync();

            return Ok(messages);
        }

        // Mark as read
        [HttpPost("{id}/mark-read")]
        public async Task<IActionResult> MarkAsRead(Guid id)
        {
            if (User.IsDemo())
            {
                var demoUserId = User.GetUserId();
                if (demoUserId == Guid.Empty) return Unauthorized();
                var demoMsg = await _context.DemoMessages
                    .FirstOrDefaultAsync(m => m.Id == id && (m.DemoRecipientId == null || m.DemoRecipientId == demoUserId));
                if (demoMsg == null) return NotFound();
                demoMsg.IsRead = true;
                await _context.SaveChangesAsync();
                return Ok();
            }

            var msg = await _context.Messages.FindAsync(id);
            if (msg == null) return NotFound();
            msg.IsRead = true;
            await _context.SaveChangesAsync();
            return Ok();
        }

        // Create a message (to everyone or to one)
        [HttpPost("send")]
        public async Task<IActionResult> Send([FromBody] Message msg)
        {
            _context.Messages.Add(msg);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Message sent" });
        }

        [HttpGet("unread-count/{userId}")]
        public async Task<IActionResult> GetUnreadCount(Guid userId)
        {
            if (User.IsDemo())
            {
                userId = User.ResolveRequestedUserId(userId);
                if (userId == Guid.Empty) return Unauthorized();
                var demoCount = await _context.DemoMessages
                    .CountAsync(m => (m.DemoRecipientId == null || m.DemoRecipientId == userId) && !m.IsRead);
                return Ok(new { count = demoCount });
            }

            var count = await _context.Messages
           .Where(m => (m.RecipientId == null || m.RecipientId == userId) && !m.IsRead)
           .CountAsync();
            return Ok(new { count });
             
        }
    }
}
