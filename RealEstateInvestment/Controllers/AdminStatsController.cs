using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
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


    }

}
