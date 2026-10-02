using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RealEstateInvestment.Services.Demo;

namespace RealEstateInvestment.Services;

public static class BackgroundJobRegistration
{
    public const string EnabledSetting = "BackgroundJobs:Enabled";

    public static bool AddOwnersClubBackgroundJobs(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var enabled = bool.TryParse(configuration[EnabledSetting]?.Trim(), out var configured)
            && configured;

        if (!enabled) return false;

        services.AddHostedService<ScheduledTaskService>();
        services.AddHostedService<MonthlyReportsHostedService>();
        services.AddHostedService<DemoMonthlyHostedService>();
        return true;
    }
}
