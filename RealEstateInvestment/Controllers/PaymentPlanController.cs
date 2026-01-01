using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/properties/{propertyId}/payment-plans")]
    public class PaymentPlanController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PaymentPlanController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetPaymentPlans(Guid propertyId)
        {
            var plans = await _context.PaymentPlans
                .Where(p => p.PropertyId == propertyId)
                .OrderBy(p => p.DueDate)
                .ToListAsync();

            return Ok(plans);
        }

        [HttpPost]
        public async Task<IActionResult> CreatePaymentPlan(Guid propertyId, [FromBody] PaymentPlan plan)
        {
            if (plan == null)
                return BadRequest();

            plan.PropertyId = propertyId;

            if (plan.DueDate.Kind == DateTimeKind.Unspecified)
            {
                plan.DueDate = DateTime.SpecifyKind(plan.DueDate, DateTimeKind.Utc);
            }
            if (plan.EventDate.HasValue && plan.EventDate.Value.Kind == DateTimeKind.Unspecified)
            {
                plan.EventDate = DateTime.SpecifyKind(plan.EventDate.Value, DateTimeKind.Utc);
            }

            _context.PaymentPlans.Add(plan);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add some guid later
                    Action = "CreatePaymentPlan error",
                    Details = ex.Message,
                });
                await _context.SaveChangesAsync();
                return BadRequest(ex);
            }


            return Ok(new { message = "Payment plan added." });
        }

        [HttpPut("{planId}")]
        public async Task<IActionResult> UpdatePaymentPlan(Guid propertyId, Guid planId, [FromBody] PaymentPlan updated)
        {
            var plan = await _context.PaymentPlans.FirstOrDefaultAsync(p => p.Id == planId && p.PropertyId == propertyId);
            if (plan == null) return NotFound();

            plan.Milestone = updated.Milestone;
            plan.EventDate = updated.EventDate;
            plan.DueDate = updated.DueDate;
            plan.InstallmentCode = updated.InstallmentCode;
            plan.Percentage = updated.Percentage;
            plan.AmountDue = updated.AmountDue;
            plan.VAT = updated.VAT;
            plan.Total = updated.Total;
            plan.Paid = updated.Paid;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Payment plan updated." });
        }

        [HttpDelete("{planId}")]
        public async Task<IActionResult> DeletePaymentPlan(Guid propertyId, Guid planId)
        {
            var plan = await _context.PaymentPlans.FirstOrDefaultAsync(p => p.Id == planId && p.PropertyId == propertyId);
            if (plan == null) return NotFound();

            _context.PaymentPlans.Remove(plan);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Payment plan deleted." });
        }
    }
}
