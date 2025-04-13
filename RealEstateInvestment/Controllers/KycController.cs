﻿using Microsoft.AspNetCore.Mvc;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using Microsoft.EntityFrameworkCore;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/kyc")]
    public class KycController : ControllerBase
    {
        private readonly AppDbContext _context;
        public KycController(AppDbContext context) => _context = context;

        [HttpPost("upload")]
        public async Task<IActionResult> Upload([FromBody] KycDocument doc)
        {
            _context.KycDocuments.Add(doc);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Document uploaded" });
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserDocs(Guid userId)
        {
            var docs = await _context.KycDocuments
                .Where(x => x.UserId == userId)
                .ToListAsync();
            return Ok(docs);
        }

        [HttpGet("pending")]
        public async Task<IActionResult> GetPending()
        {
            var docs = await _context.KycDocuments
                .Where(x => x.Status == "pending")
                .ToListAsync();
            return Ok(docs);
        }

        [HttpPost("{id}/approve")]
        public async Task<IActionResult> Approve(Guid id)
        {
            var doc = await _context.KycDocuments.FindAsync(id);
            if (doc == null) return NotFound();
            doc.Status = "approved";
            await _context.SaveChangesAsync();
            return Ok(new { message = "Approved" });
        }

        [HttpPost("{id}/reject")]
        public async Task<IActionResult> Reject(Guid id)
        {
            var doc = await _context.KycDocuments.FindAsync(id);
            if (doc == null) return NotFound();
            doc.Status = "rejected";
            await _context.SaveChangesAsync();
            return Ok(new { message = "Rejected" });
        }

        // Admin Upload docs for user
        //[HttpPost("admin-upload")]
        //public async Task<IActionResult> AdminUpload([FromBody] KycDocument doc)
        //{
        //    _context.KycDocuments.Add(doc);
        //    await _context.SaveChangesAsync();
        //    return Ok(new { message = "Document uploaded by admin" });
        //}

        // Admin Upload docs for user
        [HttpPost("admin-upload")]
        public async Task<IActionResult> AdminUpload([FromBody] KycDocument doc)
        {
            if (doc == null || doc.UserId == Guid.Empty || string.IsNullOrEmpty(doc.Base64File))
                return BadRequest(new { message = "Invalid data" });

            _context.KycDocuments.Add(doc);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Upload successful" });
        }

        [HttpPost("{id}/delete")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var doc = await _context.KycDocuments.FindAsync(id);
            if (doc == null) return NotFound();

            _context.KycDocuments.Remove(doc);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Deleted" });
        }
         
    }
}
