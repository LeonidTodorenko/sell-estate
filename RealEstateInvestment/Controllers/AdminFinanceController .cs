using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Dtos;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;

namespace RealEstateInvestment.Controllers
{
    
    [ApiController]
    [Route("api/admin/finance")]
    public class AdminFinanceController : ControllerBase
    {
        private readonly ICashFlowService _svc;
        private readonly AppDbContext _db;

        public AdminFinanceController(ICashFlowService svc, AppDbContext db) 
        { _svc = svc; 
            _db = db; 
        }

        [HttpGet("forecast")]
        public async Task<IActionResult> Forecast([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            var me = await CurrentUserAsync();
            if (me == null || !me.IsAdmin()) return Forbid();

            var start = new DateTime((from ?? DateTime.UtcNow).Year, (from ?? DateTime.UtcNow).Month, 1);
            var end = to ?? start.AddMonths(6); // по умолчанию 6 мес

            var data = await _svc.BuildForecastAsync(start, end);
            return Ok(data);
        }

        // Controllers/AdminFinanceController.cs (добавь эндпоинт)
        [HttpGet("period/{ym}")]
        public async Task<IActionResult> PeriodDetails(string ym)
        {
            // var me = await CurrentUserAsync(); if (!me.IsAdmin()) return Forbid();

            // ожидаем формат yyyy-MM
            if (string.IsNullOrWhiteSpace(ym) || ym.Length != 7 || ym[4] != '-')
                return BadRequest("Use format yyyy-MM");

            var year = int.Parse(ym.Substring(0, 4));
            var month = int.Parse(ym.Substring(5, 2));

            var start = new DateTime(year, month, 1);
            var end = start.AddMonths(1).AddTicks(-1);

            var forecast = await _svc.BuildForecastAsync(start, start); // строим на 1 месяц

            var period = forecast.Periods.FirstOrDefault(p => p.Period == start);
            if (period == null) return NotFound();

            var propIds = period.Items
                   .Where(i => i.PropertyId.HasValue)
                   .Select(i => i.PropertyId!.Value)
                   .Distinct()
                   .ToList();

            if (propIds.Count > 0)
            {
                var props = await _db.Properties
                    .Where(p => propIds.Contains(p.Id))
                    .Select(p => new { p.Id, p.Title })
                    .ToListAsync();

                var titleById = props.ToDictionary(p => p.Id, p => p.Title);

                foreach (var item in period.Items)
                {
                    if (item.PropertyId.HasValue &&
                        string.IsNullOrEmpty(item.PropertyTitle) &&
                        titleById.TryGetValue(item.PropertyId.Value, out var title))
                    {
                        item.PropertyTitle = title;
                    }
                }
            }

            return Ok(period);
        }


        // todo дубль код
        private async Task<User?> CurrentUserAsync()
        {
            var id = User.GetUserId();
            return await _db.Users.FirstOrDefaultAsync(x => x.Id == id);
        }



    }

  
}
