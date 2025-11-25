using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/admin/users")]
    public class AdminUsersController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IMonthlyReportService _monthlyReport;

        public AdminUsersController(AppDbContext db, IMonthlyReportService monthlyReport)
        {
            _db = db;
            _monthlyReport = monthlyReport;
        }

        [HttpPost("{id}/send-monthly-report")]
        public async Task<IActionResult> SendMonthlyReport(Guid id, [FromQuery] string? month)
        {
            var me = await CurrentUserAsync();
            if (me == null || !me.IsAdmin()) return Forbid();

            DateTime periodStart;
            if (string.IsNullOrWhiteSpace(month))
            {
                // прошлый месяц по умолчанию
                var now = DateTime.UtcNow;
                var firstThisMonth = new DateTime(now.Year, now.Month, 1);
                periodStart = firstThisMonth.AddMonths(-1);
            }
            else
            {
                if (month.Length != 7 || month[4] != '-')
                    return BadRequest("Use format yyyy-MM");

                var year = int.Parse(month.Substring(0, 4));
                var mm = int.Parse(month.Substring(5, 2));
                periodStart = new DateTime(year, mm, 1);
            }

            await _monthlyReport.GenerateAndSendMonthlyReportAsync(id, periodStart);

            return Ok(new { message = $"Monthly report for {periodStart:yyyy-MM} requested." });
        }

        private async Task<User?> CurrentUserAsync()
        {
            var id = User.GetUserId();
            return await _db.Users.FirstOrDefaultAsync(x => x.Id == id);
        }
    }

}
