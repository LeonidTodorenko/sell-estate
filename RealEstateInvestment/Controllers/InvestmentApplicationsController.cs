using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
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
        public async Task<IActionResult> SubmitApplication([FromBody] InvestmentApplication req)
        {
            var user = await _context.Users.FindAsync(req.UserId);
            if (user == null) return NotFound(new { message = "User not found" });
             
            var property = await _context.Properties
                                         .Include(p => p.PaymentPlans)
                                         .FirstOrDefaultAsync(p => p.Id == req.PropertyId);
            if (property == null) return NotFound(new { message = "Property not found" });

            if (property.PaymentPlans == null || !property.PaymentPlans.Any())
                return BadRequest(new { message = "No payment plan found" });

            // Проверка, что есть активный этап
            var now = DateTime.UtcNow;
            var step = property.PaymentPlans?
                .FirstOrDefault(p => p.EventDate <= now && now <= p.DueDate);

            if (step == null)
                return BadRequest(new { message = "No active payment step" });

            //if (DateTime.UtcNow > property.ApplicationDeadline)
            //    return BadRequest(new { message = "Application deadline passed" });

            // calculating and checking wallet
            var pricePerShare = property.Price / property.TotalShares;
            var expectedAmount = req.RequestedShares * pricePerShare;

            if (user.WalletBalance < expectedAmount)
                return BadRequest(new { message = "Insufficient funds" });


            // Если это первый шаг — сохраняем как заявку
            var minEventDate = property.PaymentPlans.Min(p => p.EventDate);

            if (step.EventDate == minEventDate)
            {
                // Это самый первый шаг
                var app = new InvestmentApplication
                {
                    UserId = req.UserId,
                    PropertyId = req.PropertyId,
                    RequestedAmount = req.RequestedAmount,
                    RequestedShares = req.RequestedShares,
                    StepNumber = req.StepNumber,
                    IsPriority = false,
                    Status = "pending",
                    CreatedAt = now
                };


                _context.InvestmentApplications.Add(app);

                // Если сумма >= нужной для текущего этапа — пользователь становится приоритетным
                if (expectedAmount >= step.Total)
                {
                    property.PriorityInvestorId = req.UserId;
                }
            }
            else
            {
                // Автоматическое превращение заявки в инвестицию
                user.WalletBalance -= expectedAmount;
                property.AvailableShares -= req.RequestedShares;

                _context.Investments.Add(new Investment
                {
                    UserId = req.UserId,
                    PropertyId = req.PropertyId,
                    Shares = req.RequestedShares,
                    InvestedAmount = expectedAmount,
                    CreatedAt = now
                });
            }
             
            //var app = new InvestmentApplication
            //{
            //    UserId = req.UserId,
            //    PropertyId = req.PropertyId,
            //    RequestedAmount = req.RequestedAmount,
            //    RequestedShares = req.RequestedShares,
            //    StepNumber = req.StepNumber,
            //    IsPriority = false
            //};

            //_context.InvestmentApplications.Add(app);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Application submitted" });
        }

        [HttpGet("user/{userId}")]
        [Authorize(Roles = "investor")]
        public async Task<IActionResult> GetUserApplications(Guid userId)
        {
            var apps = await _context.InvestmentApplications
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
            return Ok(apps);
        }

        [HttpGet("property/{propertyId}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> GetApplicationsByProperty(Guid propertyId)
        {
            var apps = await _context.InvestmentApplications
                .Where(a => a.PropertyId == propertyId)
                .OrderByDescending(a => a.RequestedAmount)
                .ToListAsync();
            return Ok(apps);
        }

        [HttpPost("{id}/approve")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> ApproveApplication(Guid id, [FromBody] int approvedShares)
        {
            var app = await _context.InvestmentApplications.FindAsync(id);
            if (app == null) return NotFound();

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
            return Ok(new { message = "Application approved" });
        }

        [HttpPost("{id}/reject")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> RejectApplication(Guid id)
        {
            var app = await _context.InvestmentApplications.FindAsync(id);
            if (app == null) return NotFound();

            app.Status = "rejected";
            await _context.SaveChangesAsync();
            return Ok(new { message = "Application rejected" });
        }


        [HttpPost("{id}/carry")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> CarryApplication(Guid id)
        {
            var app = await _context.InvestmentApplications.FindAsync(id);
            if (app == null) return NotFound();

            app.Status = "carried";
            app.StepNumber += 1;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Application carried over" });
        }

        //  обновление статуса приоритета (в будущем возможно автоматизируем)
        [HttpPost("{id}/update-priority")]
        [Authorize(Roles = "admin")]
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
        [Authorize(Roles = "admin")]
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
