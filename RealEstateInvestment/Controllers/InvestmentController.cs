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

        // ✅ Инвестор подаёт заявку на покупку долей
        [HttpPost("apply")]
        public async Task<IActionResult> ApplyForInvestment([FromBody] Investment investmentRequest)
        {
            var property = await _context.Properties.FindAsync(investmentRequest.PropertyId);
            if (property == null) return NotFound(new { message = "Объект не найден" });

            if (DateTime.UtcNow > property.ApplicationDeadline)
                return BadRequest(new { message = "Срок подачи заявок истёк" });

            if (property.AvailableShares < investmentRequest.Shares)
                return BadRequest(new { message = "Недостаточно свободных долей" });

            // Если инвестор предлагает оплатить Upfront Payment, он получает приоритетное право
            if (investmentRequest.InvestedAmount >= property.UpfrontPayment)
            {
                property.PriorityInvestorId = investmentRequest.UserId;
            }

            // Сохраняем заявку
            _context.Investments.Add(investmentRequest);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Заявка подана" });
        }

        // ✅ Завершаем процесс покупки долей (используется после истечения срока заявок)
        [HttpPost("finalize/{propertyId}")]
        public async Task<IActionResult> FinalizeInvestment(Guid propertyId)
        {
            var property = await _context.Properties.FindAsync(propertyId);
            if (property == null) return NotFound(new { message = "Объект не найден" });

            if (DateTime.UtcNow < property.ApplicationDeadline)
                return BadRequest(new { message = "Срок подачи заявок ещё не истёк" });

            var priorityInvestor = await _context.Investments
                .Where(i => i.PropertyId == propertyId && i.UserId == property.PriorityInvestorId)
                .FirstOrDefaultAsync();

            if (priorityInvestor != null)
            {
                // Приоритетный инвестор выкупает все доступные доли
                property.AvailableShares = 0;
            }
            else
            {
                // Если никто не внёс Upfront Payment, доли распределяются по заявкам
                var investments = await _context.Investments
                    .Where(i => i.PropertyId == propertyId)
                    .OrderByDescending(i => i.InvestedAmount) // Чем больше сумма, тем выше шанс получить доли
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
            return Ok(new { message = "Инвестиции распределены" });
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

    }
}
