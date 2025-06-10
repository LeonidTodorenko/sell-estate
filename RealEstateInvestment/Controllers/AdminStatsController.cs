using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize(Roles = "admin")]
    [Route("api/admin/stats")]
    public class AdminStatsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminStatsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetStats()
        {
            var investors = await _context.Users.CountAsync(u => u.Role == "investor");
            var totalInvestments = await _context.Investments.SumAsync(i => i.InvestedAmount);
            var totalProperties = await _context.Properties.CountAsync();
            var totalRentalIncome = await _context.RentalIncomes.SumAsync(r => (decimal?)r.Amount) ?? 0;
            var pendingWithdrawals = await _context.WithdrawalRequests.CountAsync(w => w.Status == "pending");
            var pendingKyc = await _context.Users.CountAsync(u => u.KycStatus == "pending");

            return Ok(new
            {
                investors,
                totalInvestments,
                totalProperties,
                totalRentalIncome,
                pendingWithdrawals,
                pendingKyc
            });
        }


        [HttpGet("payment-plan-summary")]
        public IActionResult GetPaymentPlanSummary()
        {
            var summary = _context.PaymentPlans
                .Where(p => p.DueDate > DateTime.UtcNow)
                .Join(_context.Properties,
                    plan => plan.PropertyId,
                    property => property.Id,
                    (plan, property) => new
                    {
                        property.Title,
                        plan.DueDate,
                        plan.Total,
                        plan.Paid,
                        Outstanding = plan.Total - plan.Paid
                    })
                .AsEnumerable()  
                .GroupBy(x => new
                {
                    Month = new DateTime(x.DueDate.Year, x.DueDate.Month, 1),
                    x.Title
                })
                .Select(g => new
                {
                    Month = g.Key.Month.ToString("yyyy-MM"),
                    PropertyTitle = g.Key.Title,
                    TotalDue = g.Sum(x => x.Total),
                    TotalPaid = g.Sum(x => x.Paid),
                    TotalOutstanding = g.Sum(x => x.Outstanding)
                })
                .OrderBy(x => x.Month)
                .ThenBy(x => x.PropertyTitle)
                .ToList();  

            return Ok(summary);
        }
         
        [HttpGet("logs")]
        public async Task<IActionResult> GetLogs([FromQuery] string? action, [FromQuery] string? userName, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var query = from log in _context.ActionLogs
                        join u in _context.Users on log.UserId equals u.Id into lj
                        from userInfo in lj.DefaultIfEmpty()
                        select new
                        {
                            log.Id,
                            log.UserId,
                            UserName = userInfo.FullName,
                            log.Action,
                            log.Details,
                            log.Timestamp
                        };

            if (!string.IsNullOrWhiteSpace(action))
                query = query.Where(l => l.Action.ToLower().Contains(action.ToLower()));

            if (!string.IsNullOrWhiteSpace(userName))
                query = query.Where(l => l.UserName != null && l.UserName.ToLower().Contains(userName.ToLower()));

            var total = await query.CountAsync();

            var items = await query
                .OrderByDescending(l => l.Timestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new
            {
                total,
                page,
                pageSize,
                items
            });
        }

        [HttpGet("superuser")]
        public async Task<IActionResult> GetSuperUserData()
        {
            var superUser = await _context.Users
                .Include(u => u.Investments)
                .ThenInclude(i => i.Property)
                .FirstOrDefaultAsync(u => u.Role == "superuser");

            if (superUser == null) return NotFound("Superuser not found");

            return Ok(new
            {
                WalletBalance = superUser.WalletBalance,
                Investments = superUser.Investments.Select(i => new
                {
                    i.PropertyId,
                    PropertyTitle = i.Property.Title,
                    i.Shares,
                    i.InvestedAmount
                })
            });
        }

        [HttpPost("superuser/update-balance")]
        public async Task<IActionResult> UpdateSuperUserBalance([FromQuery] decimal delta)
        {
            var superUser = await _context.Users.FirstOrDefaultAsync(u => u.Role == "superuser");
            if (superUser == null) return NotFound("Superuser not found");

            superUser.WalletBalance += delta;

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = superUser.Id,
                Action = "UpdateSuperUserBalance",
                Details = $"Changed by admin. Delta: {delta}"
            });

            await _context.SaveChangesAsync();
            return Ok(new { superUser.WalletBalance });
        }


        [HttpGet("settings/cancel-fee")]
        public IActionResult GetCancelFee()
        {
            var fee = _context.SystemSettings.FirstOrDefault(s => s.Key == "CancelListingFee")?.Value;
            return Ok(fee ?? "0");
        }

        // todo move
        public async Task<decimal> GetDecimalSetting(AppDbContext context, string key, decimal defaultValue)
        {
            var setting = await context.SystemSettings.FindAsync(key);
            if (setting != null && decimal.TryParse(setting.Value, out var value))
                return value;

            return defaultValue;
        }
         
    }

}
