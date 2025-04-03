using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/investments")]
    public class InvestmentController : ControllerBase
    {
        private readonly AppDbContext _context;

        public InvestmentController(AppDbContext context)
        {
            _context = context;
        }

        //   An investor submits an application to purchase shares
        [HttpPost("apply")]
        public async Task<IActionResult> ApplyForInvestment([FromBody] Investment investmentRequest)
        {
            var property = await _context.Properties.FindAsync(investmentRequest.PropertyId);
            if (property == null) return NotFound(new { message = "Object not found" });

            if (DateTime.UtcNow > property.ApplicationDeadline)
                return BadRequest(new { message = "The application deadline has expired" });

            if (property.AvailableShares < investmentRequest.Shares)
                return BadRequest(new { message = "Not enough free shares" });

            // If an investor offers to pay the Upfront Payment, they will receive priority
            if (investmentRequest.InvestedAmount >= property.UpfrontPayment)
            {
                property.PriorityInvestorId = investmentRequest.UserId;
            }

            // Save the application
            _context.Investments.Add(investmentRequest);
            await _context.SaveChangesAsync();
            return Ok(new { message = "The application has been submitted" });
        }

        // Completing the share purchase process (used after the bid period expires)
        [HttpPost("finalize/{propertyId}")]
        public async Task<IActionResult> FinalizeInvestment(Guid propertyId)
        {
            var property = await _context.Properties.FindAsync(propertyId);
            if (property == null) return NotFound(new { message = "Object not found" });

            if (DateTime.UtcNow < property.ApplicationDeadline)
                return BadRequest(new { message = "The deadline for applications has not yet expired" });

            var priorityInvestor = await _context.Investments
                .Where(i => i.PropertyId == propertyId && i.UserId == property.PriorityInvestorId)
                .FirstOrDefaultAsync();

            if (priorityInvestor != null)
            {
                // The priority investor buys out all available shares
                property.AvailableShares = 0;
            }
            else
            {
                //
                // добавить внутреннюю биржу 
                // переделать на дату подачи - если только один не перекрыл всю сумму (сумма для старта, сумма пеймент плана, у админа есть возможность повысить стоимость объекта но shares остаются прежними  у тех кто купил первыми, добавить дату сдачи дома ожидаемую, добавить возможность выставлять объект с определенным числом SHARES , допустим распредление раз в месяц происходит)
                // If no one has made an Upfront Payment, shares are distributed among applications
                var investments = await _context.Investments
                    .Where(i => i.PropertyId == propertyId)
                    .OrderByDescending(i => i.InvestedAmount) // The higher the amount, the higher the chance of getting shares
                    .ToListAsync();

                foreach (var investment in investments)
                {
                    if (property.AvailableShares == 0) break;

                    int allocatedShares = Math.Min(investment.Shares, property.AvailableShares);
                    investment.Shares = allocatedShares;
                    property.AvailableShares -= allocatedShares;
                }
            }

            property.Status = "sold";
            await _context.SaveChangesAsync();
            return Ok(new { message = "Investments distributed" });
        }

        // Get user investments
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserInvestments(Guid userId)
        {
            var investments = await _context.Investments
                .Where(i => i.UserId == userId)
                .ToListAsync();

            return Ok(investments);
        }

        [HttpGet("all")]
        public async Task<IActionResult> GetAllInvestments()
        {
            var result = await (
                from i in _context.Investments
                join u in _context.Users on i.UserId equals u.Id
                join p in _context.Properties on i.PropertyId equals p.Id
                orderby i.CreatedAt descending
                select new
                {
                    InvestmentId = i.Id,
                    UserId = u.Id,
                    UserName = u.FullName,
                    PropertyName = p.Title,
                    i.Shares,
                    i.InvestedAmount,
                    i.CreatedAt
                }
            ).ToListAsync();

            return Ok(result);
        }

        [HttpGet("kyc/pending")]
        public async Task<IActionResult> GetUsersWithPendingKyc()
        {
            var users = await _context.Users
                .Where(u => u.KycStatus == "pending")
                .OrderBy(u => u.CreatedAt)
                .ToListAsync();

            return Ok(users);
        }

        [HttpPost("{id}/kyc/verify")]
        public async Task<IActionResult> VerifyKyc(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.KycStatus = "verified";
            await _context.SaveChangesAsync();

            return Ok(new { message = "User KYC verified" });
        }

        [HttpPost("{id}/kyc/reject")]
        public async Task<IActionResult> RejectKyc(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.KycStatus = "rejected";
            await _context.SaveChangesAsync();

            return Ok(new { message = "User KYC rejected" });
        }

        [HttpGet("with-details/{userId}")]
        public async Task<IActionResult> GetUserInvestmentsWithDetails(Guid userId)
        {
            var result = await (
                from i in _context.Investments
                join p in _context.Properties on i.PropertyId equals p.Id
                where i.UserId == userId
                select new
                {
                    InvestmentId = i.Id,
                    PropertyId = p.Id,
                    PropertyTitle = p.Title,
                    i.Shares,
                    i.InvestedAmount,
                    i.CreatedAt,
                    Percent = Math.Round(i.InvestedAmount / p.Price * 100, 2)
                }
            ).ToListAsync();

            return Ok(result);
        }


    }
}
