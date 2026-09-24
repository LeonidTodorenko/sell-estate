using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [FinancialConcurrency]
    [Route("api/applications")]
    public class InvestmentApplicationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public InvestmentApplicationsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("submit")]
        [Authorize(Roles = "investor")]
        public IActionResult SubmitApplication([FromBody] InvestmentApplication req)
        {
            return StatusCode(StatusCodes.Status410Gone, new { message = "Use /api/investments/apply with PIN or password" });
        }

        //[HttpGet("user/{userId}")]
        //[Authorize(Roles = "investor")]
        //public async Task<IActionResult> GetUserApplications(Guid userId)
        //{
        //    var apps = await _context.InvestmentApplications
        //        .Where(a => a.UserId == userId)
        //        .OrderByDescending(a => a.CreatedAt)
        //        .ToListAsync();
        //    return Ok(apps);
        //}

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserApplications(Guid userId)
        {
            if (User.IsDemo())
            {
                var demoUserId = User.GetUserId();
                var demoApps = await (
                    from app in _context.DemoInvestmentApplications.AsNoTracking()
                    join p in _context.Properties.AsNoTracking() on app.PropertyId equals p.Id
                    where app.DemoUserId == demoUserId
                    orderby app.CreatedAt descending
                    select new
                    {
                        app.Id, app.PropertyId, PropertyTitle = p.Title, app.RequestedAmount,
                        app.RequestedShares, app.ApprovedAmount, app.ApprovedShares, app.Status,
                        app.IsPriority, app.StepNumber, app.CreatedAt
                    }).ToListAsync();
                return Ok(demoApps);
            }

            var apps = await (
                from app in _context.InvestmentApplications
                join p in _context.Properties on app.PropertyId equals p.Id
                where app.UserId == userId
                orderby app.CreatedAt descending
                select new
                {
                    app.Id,
                    app.PropertyId,
                    PropertyTitle = p.Title,
                    app.RequestedAmount,
                    app.RequestedShares,
                    app.ApprovedAmount,
                    app.ApprovedShares,
                    app.Status,
                    app.IsPriority,
                    app.StepNumber,
                    app.CreatedAt
                }
            ).ToListAsync();

            return Ok(apps);
        }


        [HttpGet("property/{propertyId}")]
        [FinancialAdmin]
        public async Task<IActionResult> GetApplicationsByProperty(Guid propertyId)
        {
            var apps = await _context.InvestmentApplications
                .Where(a => a.PropertyId == propertyId)
                .OrderByDescending(a => a.RequestedAmount)
                .ToListAsync();
            return Ok(apps);
        }

        [HttpPost("{id}/approve")]
        [FinancialAdmin]
        public async Task<IActionResult> ApproveApplication(Guid id, [FromBody] int approvedShares)
        {
            await using var financialTransaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);

            var app = await _context.InvestmentApplications.FindAsync(id);
            if (app == null) return NotFound();
            if (app.Status != "pending") return Conflict("Application already processed");

            if (approvedShares <= 0 || approvedShares > app.RequestedShares) return BadRequest("Invalid approved shares");

            var property = await _context.Properties.FindAsync(app.PropertyId);
            var user = await _context.Users.FindAsync(app.UserId);
            if (property == null || user == null) return BadRequest();

            if (property.AvailableShares < approvedShares)
                return BadRequest(new { message = "Not enough shares" });

            decimal pricePerShare = property.Price / property.TotalShares;
            decimal approvedAmount = approvedShares * pricePerShare;

            if (user.WalletBalance < approvedAmount)
                return BadRequest(new { message = "Insufficient funds" });

            user.WalletBalance -= approvedAmount;
            property.AvailableShares -= approvedShares;

            _context.Investments.Add(new Investment
            {
                UserId = app.UserId,
                PropertyId = app.PropertyId,
                Shares = approvedShares,
                InvestedAmount = approvedAmount
            });

            app.Status = approvedShares == app.RequestedShares ? "accepted" : "partial";
            app.ApprovedShares = approvedShares;
            app.ApprovedAmount = approvedAmount;

            await _context.SaveChangesAsync();
            await financialTransaction.CommitAsync();
            return Ok(new { message = "Application approved" });
        }

        [HttpPost("{id}/reject")]
        [FinancialAdmin]
        public async Task<IActionResult> RejectApplication(Guid id)
        {
            await using var financialTransaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);

            var app = await _context.InvestmentApplications.FindAsync(id);
            if (app == null) return NotFound();
            if (app.Status != "pending") return Conflict("Application already processed");

            app.Status = "rejected";
            await _context.SaveChangesAsync();
            await financialTransaction.CommitAsync();
            return Ok(new { message = "Application rejected" });
        }


        [HttpPost("{id}/carry")]
        [FinancialAdmin]
        public async Task<IActionResult> CarryApplication(Guid id)
        {
            await using var financialTransaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);

            var app = await _context.InvestmentApplications.FindAsync(id);
            if (app == null) return NotFound();
            if (app.Status != "pending") return Conflict("Application already processed");

            app.Status = "carried";
            app.StepNumber += 1;
            await _context.SaveChangesAsync();
            await financialTransaction.CommitAsync();
            return Ok(new { message = "Application carried over" });
        }

        //  обновление статуса приоритета (в будущем возможно автоматизируем)
        [HttpPost("{id}/update-priority")]
        [FinancialAdmin]
        public async Task<IActionResult> UpdatePriority(Guid id, [FromBody] bool isPriority)
        {
            var app = await _context.InvestmentApplications.FindAsync(id);
            if (app == null) return NotFound();

            app.IsPriority = isPriority;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Priority updated" });
        }

        // Автоматическая расстановка приоритета
        //    Он будет проходить по всем активным заявкам и выставлять IsPriority = true тем, у кого максимальные суммы.
        [HttpPost("recalculate-priority/{propertyId}")]
        [FinancialAdmin]
        public async Task<IActionResult> RecalculatePriority(Guid propertyId)
        {
            var apps = await _context.InvestmentApplications
                .Where(a => a.PropertyId == propertyId && a.Status == null)
                .OrderByDescending(a => a.RequestedAmount)
                .ToListAsync();

            if (apps.Count == 0)
                return Ok(new { message = "No applications to process" });

            decimal maxAmount = apps.First().RequestedAmount;
            foreach (var app in apps)
            {
                app.IsPriority = app.RequestedAmount == maxAmount;
            }

            await _context.SaveChangesAsync();
             return Ok(new { message = "Priority recalculated" });
        }
    }
 
//[POST] /api/investment-applications/{id}/update-priority – обновление статуса приоритета (в будущем возможно автоматизируем)[POST] /api/investment-applications/{id}/update-priority – обновление статуса приоритета (в будущем возможно автоматизируем)

//   [POST] /api/investment-applications/recalculate-priority/{propertyId}[POST] /api/investment-applications/recalculate-priority/{propertyId}
//Автоматическая расстановка приоритета
//    Он будет проходить по всем активным заявкам и выставлять IsPriority = true тем, у кого максимальные суммы.
}
