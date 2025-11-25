using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

using RealEstateInvestment.Data;
using RealEstateInvestment.Dtos;

namespace RealEstateInvestment.Services
{
    public interface ICashFlowService
    {
        Task<CashFlowForecastDto> BuildForecastAsync(DateTime from, DateTime to);
    }

    public class CashFlowService : ICashFlowService
    {
        private readonly AppDbContext _db;
        private readonly ISuperUserService _super;
        private readonly IConfiguration _cfg;

        public CashFlowService(AppDbContext db, ISuperUserService super, IConfiguration cfg)
        {
            _db = db; _super = super; _cfg = cfg;
        }

        // ========= ПУБЛИЧНЫЙ ПРОГНОЗ =========
        public async Task<CashFlowForecastDto> BuildForecastAsync(DateTime from, DateTime to)
        {
            // нормализуем к 1-му числу
            var start = new DateTime(from.Year, from.Month, 1);
            var endMonth = new DateTime(to.Year, to.Month, 1);

            var balance = await GetSuperUserBalanceAsync();

            // 1) ОТТОКИ: PaymentPlan с непогашенным остатком
            var plansRaw = await _db.PaymentPlans
                .Where(p => p.DueDate >= start && p.DueDate <= endMonth.AddMonths(1).AddDays(-1))
                .Select(p => new
                {
                    p.PropertyId,
                    p.Milestone,
                    p.DueDate,
                    p.Total,   // decimal (not null)
                    p.Paid     // decimal (not null)
                })
                .ToListAsync();

            var stages = plansRaw
                .Select(p => new
                {
                    p.PropertyId,
                    p.Milestone,
                    DueDate = p.DueDate.Date,
                    Required = p.Total - p.Paid
                })
                .Where(p => p.Required > 0m)
                .ToList();

            // 2) ПРИТОКИ: рента + (продажи — позже) + притоки юзеров
            var rentForecast = await BuildRentForecastAsync(start, endMonth);
            var saleForecast = new List<CashFlowLineItemDto>(); // пока нет логики продаж
            var userInflow = await BuildUserInflowForecastAsync(start, endMonth);

            var inflowsAll = rentForecast
                .Concat(saleForecast)
                .Concat(userInflow)
                .ToList();

            // 3) Агрегация по месяцам
            var periods = new List<CashFlowPeriodSummaryDto>();
            var cursor = start;
            while (cursor <= endMonth)
            {
                var periodStart = cursor;
                var periodEnd = periodStart.AddMonths(1).AddTicks(-1);

                var dueThisPeriod = stages
                    .Where(s => s.DueDate >= periodStart && s.DueDate <= periodEnd)
                    .Sum(s => s.Required);

                var inflowsTillDate = inflowsAll
                    .Where(i => i.Date <= periodEnd)
                    .Sum(i => i.Amount);

                var available = balance + inflowsTillDate;
                var shortfall = Math.Max(0m, dueThisPeriod - available);

                var items = new List<CashFlowLineItemDto>();

                items.AddRange(stages
                    .Where(s => s.DueDate >= periodStart && s.DueDate <= periodEnd)
                    .Select(s => new CashFlowLineItemDto
                    {
                        Date = s.DueDate,
                        PropertyId = s.PropertyId,
                        Kind = "Outflow:PaymentPlan",
                        Label = s.Milestone,
                        Amount = -s.Required
                    }));

                items.AddRange(inflowsAll
                    .Where(i => i.Date >= periodStart && i.Date <= periodEnd));

                periods.Add(new CashFlowPeriodSummaryDto
                {
                    Period = periodStart,
                    RequiredOutflow = dueThisPeriod,
                    AvailableOnDate = available,
                    Shortfall = shortfall,
                    Items = items.OrderBy(x => x.Date).ToList()
                });

                cursor = cursor.AddMonths(1);
            }

            return new CashFlowForecastDto
            {
                SuperUserBalance = balance,
                Periods = periods
            };
        }

        // ========= РЕНТА: MonthlyRentalIncome × доля суперюзера =========
        private async Task<List<CashFlowLineItemDto>> BuildRentForecastAsync(DateTime start, DateTime end)
        {
            var superUserId = _super.GetSuperUserId();

            // NOTE: если MonthlyRentalIncome/Price у тебя non-nullable decimal —
            // никакого ?? 0m не используем.
            var props = await _db.Properties
     .Where(p => p.MonthlyRentalIncome > 0m)  
                 .Select(p => new
                {
                    p.Id,
                    p.Title,
                     MonthlyRentalIncome = p.MonthlyRentalIncome, 
                     Price = p.Price,                      
                     TotalShares = p.TotalShares               
                 })
                .ToListAsync();

            var superAgg = await _db.Investments
                .Where(i => i.UserId == superUserId)
                .GroupBy(i => i.PropertyId)
                .Select(g => new
                {
                    PropertyId = g.Key,
                    Shares = g.Sum(x => x.Shares),          
                    Invested = g.Sum(x => x.InvestedAmount)    
                })
                .ToListAsync();

            var superByProperty = superAgg.ToDictionary(x => x.PropertyId, x => x);

            var result = new List<CashFlowLineItemDto>();
            var cursor = new DateTime(start.Year, start.Month, 1);

            while (cursor <= end)
            {
                foreach (var p in props)
                {
                    decimal fraction = 0m;
                    if (superByProperty.TryGetValue(p.Id, out var s))
                    {
                        if (p.TotalShares > 0 && s.Shares > 0)
                            fraction = (decimal)s.Shares / p.TotalShares;
                        else if (p.Price > 0 && s.Invested > 0)
                            fraction = s.Invested / p.Price;
                    }

                    if (fraction <= 0m) continue;

                    var amount = Math.Round(p.MonthlyRentalIncome * fraction, 2);

             
                  
                    if (amount <= 0m) continue;

                    result.Add(new CashFlowLineItemDto
                    {
                        Date = cursor,
                        PropertyId = p.Id,
                        PropertyTitle = p.Title,
                        Kind = "Inflow:Rent",
                        Label = "Rent (forecast by ownership)",
                        Amount = amount
                    });
                }

                cursor = cursor.AddMonths(1);
            }

            return result;
        }

        // ========= ПРИТОК ПОЛЬЗОВАТЕЛЕЙ: по StepNumber => N-й этап PaymentPlan =========
        private async Task<List<CashFlowLineItemDto>> BuildUserInflowForecastAsync(DateTime start, DateTime end)
        {
            var conversion = _cfg.GetValue<decimal?>("Forecast:UserInflowConversion") ?? 0.70m;

            // Этапы в диапазоне из PaymentPlan
            var plansInRange = await _db.PaymentPlans
                .Where(p => p.DueDate >= start && p.DueDate <= end.AddMonths(1).AddDays(-1))
                .ToListAsync();

            // Берём только те, где есть непогашенный остаток
            var activePlans = plansInRange
                .Where(p => (p.Total - p.Paid) > 0m)
                .ToList();

            // Индексируем для каждого PropertyId этапы по порядку (1..N), сортировка по DueDate
            var planIndexByProp = activePlans
                .GroupBy(p => p.PropertyId)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderBy(x => x.DueDate)
                          .Select((x, idx) => new { Plan = x, Index = idx + 1 })
                          .ToList()
                );

            // Заявки: берём pipeline-статусы + StepNumber
            var rawApps = await _db.InvestmentApplications
                .Select(a => new
                {
                    a.PropertyId,
                    RequestedAmount = a.RequestedAmount,
                    ApprovedAmount = a.ApprovedAmount,
                    a.StepNumber,
                    a.Status
                })
                .ToListAsync();

            bool IsPipelineStatus(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return false;
                s = s.Trim().ToLowerInvariant();
                return s == "pending" || s == "inprogress" || s == "in_progress";
            }

            var mapped = new List<(Guid PropertyId, DateTime DueDate, decimal Amount)>();

            foreach (var a in rawApps.Where(x => IsPipelineStatus(x.Status)))
            {
                if (!planIndexByProp.TryGetValue(a.PropertyId, out var stagesForProp)) continue;

                var target = stagesForProp.FirstOrDefault(x => x.Index == a.StepNumber);
                if (target == null) continue; // нет такого шага в диапазоне

                var gross = a.ApprovedAmount ?? a.RequestedAmount;
                if (gross <= 0m) continue;

                mapped.Add((a.PropertyId, target.Plan.DueDate.Date, gross));
            }

            var result = mapped
                .GroupBy(x => new { x.PropertyId, x.DueDate })
                .Select(g => new CashFlowLineItemDto
                {
                    Date = g.Key.DueDate,
                    PropertyId = g.Key.PropertyId,
                    Kind = "Inflow:User",
                    Label = "User inflow forecast (by step)",
                    Amount = Math.Round(g.Sum(z => z.Amount) * conversion, 2)
                })
                .ToList();

            return result;
        }

        // ========= БАЛАНС СУПЕРЮЗЕРА =========
        private async Task<decimal> GetSuperUserBalanceAsync()
        {
            var superId = _super.GetSuperUserId();
            var su = await _db.Users
                .Where(u => u.Id == superId)
                .Select(u => new
                {
                    Balance = u.WalletBalance
                })
                .FirstOrDefaultAsync();

            return su?.Balance ?? 0m;
        }
    }
}
