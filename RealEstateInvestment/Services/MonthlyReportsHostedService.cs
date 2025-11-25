using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Services
{
    public class MonthlyReportsHostedService : BackgroundService
    {
        private readonly IServiceProvider _services;
        private readonly ILogger<MonthlyReportsHostedService> _logger;

        public MonthlyReportsHostedService(IServiceProvider services, ILogger<MonthlyReportsHostedService> logger)
        {
            _services = services;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            DateTime? lastRunDate = null;

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var now = DateTime.UtcNow.Date;

                    // Запускать один раз в сутки, и только если сегодня 1-е число
                    if (now.Day == 1 && lastRunDate != now)
                    {
                        _logger.LogInformation("MonthlyReportsHostedService: starting monthly reports for {Date}", now);

                        using var scope = _services.CreateScope();
                        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                        var svc = scope.ServiceProvider.GetRequiredService<IMonthlyReportService>();

                        var firstThisMonth = new DateTime(now.Year, now.Month, 1);
                        var periodStart = firstThisMonth.AddMonths(-1); // прошлый месяц

                        // выбираем только нужных юзеров
                        var users = await db.Users
                            .Where(u => u.IsEmailConfirmed && !u.IsBlocked && u.Role == "investor")
                            .ToListAsync(stoppingToken);

                        foreach (var u in users)
                        {
                            try
                            {
                                await svc.GenerateAndSendMonthlyReportAsync(u.Id, periodStart);
                            }
                            catch (Exception exUser)
                            {
                                _logger.LogError(exUser, "Monthly report failed for user {UserId}", u.Id);
                            }
                        }

                        lastRunDate = now;
                        _logger.LogInformation("MonthlyReportsHostedService: finished monthly reports for {Date}", now);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "MonthlyReportsHostedService error"); // todo test
                }

                // todo test
                try
                {
                    var now = DateTime.UtcNow;

                    //   1-е число месяца, в 02:00 UTC — шлём отчёт за прошлый месяц
                    if (now.Day == 1 && now.Hour == 2)
                    {
                        var prevMonthStart = new DateTime(now.Year, now.Month, 1).AddMonths(-1);
                        var prevMonthEnd = prevMonthStart.AddMonths(1).AddTicks(-1);

                        using var scope = _services.CreateScope();
                        var auditSvc = scope.ServiceProvider.GetRequiredService<IAdminAuditReportService>();

                        await auditSvc.GenerateAndSendAdminAuditAsync(prevMonthStart, prevMonthEnd);
                    }

                    await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
                }
                catch (TaskCanceledException)
                {
                    //todo check
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "MonthlyReportsHostedService loop error"); // todo test
                }


                // Спим 6 часов, можно реже/чаще
                await Task.Delay(TimeSpan.FromHours(6), stoppingToken);
            }
        }
    }
}
