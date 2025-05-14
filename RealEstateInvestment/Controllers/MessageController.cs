using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

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

            var count = await _context.Messages
           .Where(m => (m.RecipientId == null || m.RecipientId == userId) && !m.IsRead)
           .CountAsync();
            return Ok(new { count });
             
        }

    }

}
