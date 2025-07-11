﻿using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/chat")]
    public class ChatController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ChatController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("send")]
        public async Task<IActionResult> SendMessage([FromBody] ChatMessage message)
        {
            _context.ChatMessages.Add(message);
            await _context.SaveChangesAsync();
            return Ok();
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
