using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/chat")]
    public class ChatController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ChatController(AppDbContext context)
        {
            _context = context;
        }

        public class SendChatRequest
        {
            public Guid RecipientId { get; set; }
            public string Content { get; set; } = "";
        }

        [HttpPost("send")]
        public async Task<IActionResult> SendMessage([FromBody] SendChatRequest req)
        {
            var senderId = User.GetUserId();
            if (senderId == Guid.Empty) return Unauthorized();
            if (string.IsNullOrWhiteSpace(req.Content)) return BadRequest(new { message = "Empty message" });

            var msg = new ChatMessage
            {
                Id = Guid.NewGuid(),
                SenderId = senderId,
                RecipientId = req.RecipientId,
                Content = req.Content.Trim(),
                SentAt = DateTime.UtcNow
            };

            _context.ChatMessages.Add(msg);
            await _context.SaveChangesAsync();
            return Ok(msg);
        }

        [HttpGet("conversation/{userId1}/{userId2}")]
        public async Task<IActionResult> GetConversation(Guid userId1, Guid userId2)
        {
            var messages = await _context.ChatMessages
                .Where(m => (m.SenderId == userId1 && m.RecipientId == userId2) ||
                            (m.SenderId == userId2 && m.RecipientId == userId1))
                .OrderBy(m => m.SentAt)
                .ToListAsync();

            return Ok(messages);
        }

        [HttpGet("dialog/{userId}")]
        public async Task<IActionResult> GetChatWithUser(Guid userId)
        {
            // todo переделать админа
            var admin = _context.Users.FirstOrDefault(u => u.Role == "admin");
            if (admin == null) return NotFound();

            var messages = await _context.ChatMessages
                .Where(m => (m.SenderId == admin.Id && m.RecipientId == userId) ||
                            (m.SenderId == userId && m.RecipientId == admin.Id))
                .OrderBy(m => m.SentAt)
                .ToListAsync();

            return Ok(messages);
        }

        [HttpGet("my-messages/{userId}")]
        public async Task<IActionResult> GetMyMessages(Guid userId)
        {
            var messages = await _context.ChatMessages
                .Where(m => m.SenderId == userId || m.RecipientId == userId)
                .OrderBy(m => m.SentAt)
                .ToListAsync();

            return Ok(messages);
        }

        [HttpGet("conversations")]
        public async Task<IActionResult> GetAllConversations()
        {
            var admin = _context.Users.FirstOrDefault(u => u.Role == "admin");
            if (admin == null) return NotFound();

            var userIds = await _context.ChatMessages
                .Where(m => m.SenderId == admin.Id || m.RecipientId == admin.Id)
                .Select(m => m.SenderId == admin.Id ? m.RecipientId : m.SenderId)
                .Distinct()
                .ToListAsync();

            var users = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FullName, u.Email })
                .ToListAsync();

            return Ok(users);
        }

    }

}
