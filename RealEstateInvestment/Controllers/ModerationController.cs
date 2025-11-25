using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize] // и доп.проверка прав внутри
    [Route("api/moderation")]
    public class ModerationController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IModerationService _svc;

        public ModerationController(AppDbContext db, IModerationService svc)
        {
            _db = db; _svc = svc;
        }

        [HttpGet("requests")]
        public async Task<IActionResult> List([FromQuery] ModerationStatus? status, [FromQuery] ChangeTarget? target)
        {
            var q = _db.ModerationRequests.AsQueryable();
            if (status.HasValue) q = q.Where(x => x.Status == status.Value);
            if (target.HasValue) q = q.Where(x => x.Target == target.Value);

            var data = await q.OrderByDescending(x => x.RequestedAt).Take(200).ToListAsync();
            return Ok(data);
        }

        [HttpPost("{id}/approve")]
        public async Task<IActionResult> Approve(Guid id, [FromBody] string? comment)
        {
            var userId = User.GetUserId();

            var me = await _db.Users.FindAsync(userId);
            if (me == null || !me.Permissions.Has(PermissionFlags.ApprovePropertyPriceChange))
                return Forbid();

            var ok = await _svc.ApproveAsync(id, userId, comment);
            return ok ? Ok(new { message = "Approved" }) : NotFound();
        }

        [HttpPost("{id}/reject")]
        public async Task<IActionResult> Reject(Guid id, [FromBody] string? comment)
        {
            var userId = User.GetUserId();

            var me = await _db.Users.FindAsync(userId);
            if (me == null || !me.Permissions.Has(PermissionFlags.ApprovePropertyPriceChange))
                return Forbid();

            var ok = await _svc.RejectAsync(id, userId, comment);
            return ok ? Ok(new { message = "Rejected" }) : NotFound();
        }
    }

}
