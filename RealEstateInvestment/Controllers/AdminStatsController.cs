using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize(Roles = "admin")]
    [Route("api/admin/stats")]
    public class AdminStatsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ISuperUserService _superUserService;
        private readonly ICashFlowService _cashFlowService;
        private readonly IAdminAuditReportService _auditReport;

        public AdminStatsController(ISuperUserService superUserService, AppDbContext context, ICashFlowService cashFlowService, IAdminAuditReportService auditReport)
        {
            _context = context;
            _superUserService = superUserService;
            _cashFlowService = cashFlowService;
            _auditReport = auditReport;
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
            var superUserId = _superUserService.GetSuperUserId();
            var superUser = await _context.Users.FindAsync(superUserId);
            if (superUser == null) return NotFound("Superuser not found");

            var investments = await _context.Investments
                                        .Where(i => i.UserId == superUserId)
                                        .Include(i => i.Property)
                                        .Select(i => new
                                        {
                                            i.PropertyId,
                                            PropertyTitle = i.Property.Title,
                                            i.Shares,
                                            i.InvestedAmount
                                        })
                                        .ToListAsync();

            return Ok(new
            {
                WalletBalance = superUser.WalletBalance,
                Investments = investments
            });
        }

        [HttpPost("superuser/update-balance")]
        public async Task<IActionResult> UpdateSuperUserBalance([FromQuery] decimal delta)
        {
            var superUserId = _superUserService.GetSuperUserId();
            var superUser = await _context.Users.FindAsync(superUserId);
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

        [AllowAnonymous]
        [HttpGet("settings/cancel-fee")]
        public IActionResult GetCancelFee()
        {
            var fee = _context.SystemSettings.FirstOrDefault(s => s.Key == "CancelListingFee")?.Value;
            return Ok(fee ?? "0");
        }
         
        [HttpGet("settings")]
        public async Task<IActionResult> GetAllSettings()
        {
            var settings = await _context.SystemSettings
                .Select(s => new { s.Key, s.Value })
                .ToListAsync();

            return Ok(settings);
        }
         
        [HttpPut("settings/{key}")]
        public async Task<IActionResult> UpdateSetting(string key, [FromBody] SystemSettingCurrent updated)
        {
            if (updated == null || string.IsNullOrEmpty(updated.Value))
                return BadRequest("Invalid setting value");

            var setting = await _context.SystemSettings.FindAsync(key);
            if (setting == null)
            {
                // Создаём, если не существует
                setting = new SystemSetting { Key = key, Value = updated.Value };
                _context.SystemSettings.Add(setting);
            }
            else
            {
                setting.Value = updated.Value;
                _context.SystemSettings.Update(setting);
            }

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later
                Action = "UpdateSetting",
                Details = $"Setting {key} updated to {updated.Value}"
            });

            await _context.SaveChangesAsync();
            return Ok(new { setting.Key, setting.Value });
        }

        // todo move
        public class SystemSettingCurrent
        {
            public string Value { get; set; }
        }

         
        [HttpPost("reports/audit/send")]
        public async Task<IActionResult> SendAuditReport([FromBody] AuditReportRequest req)
        {
            //var me = await CurrentUserAsync();
            //if (me == null) return Unauthorized();

            //todo проверка  Admin + SuperAdmin
            //if (!me.IsSuperAdmin(_cfg))
            //return Forbid();

            if (req.From == default || req.To == default || req.From > req.To)
                return BadRequest(new { message = "Invalid period" });

            await _auditReport.GenerateAndSendAdminAuditAsync(req.From, req.To);
            return Ok(new { message = "Audit report sent" });
        }
         

        // todo move
        public class AuditReportRequest
        {
            public DateTime From { get; set; }
            public DateTime To { get; set; }
        }





    }
}
