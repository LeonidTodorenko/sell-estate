using Microsoft.AspNetCore.Mvc;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using RealEstateInvestment.Services;
using RealEstateInvestment.Helpers;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/kyc")]
    public class KycController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IKycContractService _contractService;
        public KycController(AppDbContext context, IKycContractService contractService)
        {
            _context = context;
            _contractService = contractService;
        }

        [HttpPost("upload")]
        public async Task<IActionResult> Upload([FromBody] KycDocument doc)
        {
            if (await FinancialActor.ValidateAsync(User, _context) is { } actorError) return actorError;
            doc.UserId = User.GetUserId(); // Compatibility field; JWT is the authority.

            if (doc == null || doc.UserId == Guid.Empty || string.IsNullOrWhiteSpace(doc.Base64File))
                return BadRequest(new { message = "Invalid data" });

            if (User.IsDemo())
            {
                var demoUserId = User.GetUserId();
                if (demoUserId == Guid.Empty) return Unauthorized();
                var demoUser = await _context.DemoUsers.FindAsync(demoUserId);
                if (!FinancialActor.IsEligible(demoUser)) return NotFound(new { message = "Demo user not found" });

                _context.DemoKycDocuments.Add(new DemoKycDocument
                {
                    DemoUserId = demoUserId,
                    Type = doc.Type,
                    Base64File = doc.Base64File,
                    Status = "pending"
                });
                demoUser.KycStatus = "pending";
                _context.DemoActionLogs.Add(new DemoActionLog { DemoUserId = demoUserId, Action = "UploadKycDocument", Details = $"Virtual KYC upload: {doc.Type}" });
                await _context.SaveChangesAsync();
                return Ok(new { message = "Document uploaded in Demo Mode", simulated = true });
            }

            doc.Id = Guid.NewGuid();
            doc.Status = "pending";
            doc.UploadedAt = DateTime.UtcNow;

            _context.KycDocuments.Add(doc);

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = doc.UserId,
                Action = "Upload KycDocument",
                Details = $"KycDocument uploaded. UserId: {doc.UserId}, Type: {doc.Type}"
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = "Document uploaded" });
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserDocs(Guid userId)
        {
            if (await PrivateDataAccess.RequireOwnerAsync(User, _context, userId, HttpContext.RequestServices.GetRequiredService<IConfiguration>(), allowAdmin: true) is { } accessError) return accessError;

            if (User.IsDemo())
            {
                var demoUserId = User.GetUserId();
                if (demoUserId == Guid.Empty) return Unauthorized();
                var demoDocs = await _context.DemoKycDocuments.AsNoTracking()
                    .Where(x => x.DemoUserId == demoUserId).OrderByDescending(x => x.UploadedAt)
                    .Select(x => new { x.Id, userId = x.DemoUserId, x.Type, x.Base64File, x.Status, x.UploadedAt })
                    .ToListAsync();
                return Ok(demoDocs);
            }
            var docs = await _context.KycDocuments
                .Where(x => x.UserId == userId)
                .ToListAsync();
            return Ok(docs);
        }

        [HttpGet("pending")]
        [FinancialAdmin]
        public async Task<IActionResult> GetPending()
        {
            var docs = await _context.KycDocuments
                .Where(x => x.Status == "pending")
                .ToListAsync();
            return Ok(docs);
        }

        [HttpPost("{id}/approve")]
        [FinancialAdmin]
        public async Task<IActionResult> Approve(Guid id)
        {
            var doc = await _context.KycDocuments.FindAsync(id);
            if (doc == null) return NotFound();
            if (doc.Status != "pending") return Conflict("KYC document already processed");
            doc.Status = "approved";
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later,
                Action = "Approve KycDocument",
                Details = "KycDocument Approved id: " + id.ToString()
            });
            await _context.SaveChangesAsync();
            await _contractService.GenerateAndSendContractAsync(doc.UserId);
            return Ok(new { message = "Approved" });
        }

        [HttpPost("{id}/reject")]
        [FinancialAdmin]
        public async Task<IActionResult> Reject(Guid id)
        {
            var doc = await _context.KycDocuments.FindAsync(id);
            if (doc == null) return NotFound();
            if (doc.Status != "pending") return Conflict("KYC document already processed");
            doc.Status = "rejected";
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later,
                Action = "Reject KycDocument",
                Details = "KycDocument Reject id: " + id.ToString()
            });
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
        [FinancialAdmin]
        public async Task<IActionResult> AdminUpload([FromBody] KycDocument doc)
        {
            if (doc == null || doc.UserId == Guid.Empty || string.IsNullOrEmpty(doc.Base64File))
                return BadRequest(new { message = "Invalid data" });

            _context.KycDocuments.Add(doc);
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later,
                Action = "AdminUpload KycDocument",
                Details = "KycDocument AdminUpload id: " + doc.UserId.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Upload successful" });
        }

        [HttpPost("{id}/delete")]
        public async Task<IActionResult> Delete(Guid id)
        {
            if (await FinancialActor.ValidateAsync(User, _context) is { } actorError) return actorError;

            if (User.IsDemo())
            {
                var demoUserId = User.GetUserId();
                if (demoUserId == Guid.Empty) return Unauthorized();
                var demoDoc = await _context.DemoKycDocuments.FirstOrDefaultAsync(x => x.Id == id && x.DemoUserId == demoUserId);
                if (demoDoc == null) return NotFound();
                _context.DemoKycDocuments.Remove(demoDoc);
                var demoUser = await _context.DemoUsers.FindAsync(demoUserId);
                if (demoUser != null) demoUser.KycStatus = await _context.DemoKycDocuments.AnyAsync(x => x.DemoUserId == demoUserId && x.Id != id) ? "pending" : "not_submitted";
                _context.DemoActionLogs.Add(new DemoActionLog { DemoUserId = demoUserId, Action = "DeleteKycDocument", Details = $"Virtual KYC document deleted: {id}" });
                await _context.SaveChangesAsync();
                return Ok(new { message = "Deleted in Demo Mode", simulated = true });
            }
            var doc = await _context.KycDocuments.FindAsync(id);
            if (doc == null) return NotFound();
            if (await PrivateDataAccess.RequireOwnerAsync(User, _context, doc.UserId, HttpContext.RequestServices.GetRequiredService<IConfiguration>()) is { } accessError) return accessError;

            _context.KycDocuments.Remove(doc);
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later,
                Action = "Delete KycDocument",
                Details = "KycDocument Delete id: " + id.ToString()
            });
            await _context.SaveChangesAsync();
            return Ok(new { message = "Deleted" });
        }

    }
}
