using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RealEstateInvestment.Services;
using RealEstateInvestment.Services.Demo;
using Xunit;

namespace RealEstateInvestment.Tests;

public sealed class BackgroundJobRegistrationTests
{
    [Fact]
    public void Missing_setting_disables_all_background_jobs()
    {
        var (enabled, hostedTypes) = Register(null);

        Assert.False(enabled);
        Assert.Empty(hostedTypes);
    }

    [Theory]
    [InlineData("false")]
    [InlineData("")]
    [InlineData("not-a-boolean")]
    public void Any_value_other_than_explicit_true_disables_all_background_jobs(string value)
    {
        var (enabled, hostedTypes) = Register(value);

        Assert.False(enabled);
        Assert.Empty(hostedTypes);
    }

    [Theory]
    [InlineData("true")]
    [InlineData(" TRUE ")]
    public void Explicit_true_registers_exactly_the_three_release_jobs(string value)
    {
        var (enabled, hostedTypes) = Register(value);

        Assert.True(enabled);
        Assert.Equal(
            new[]
            {
                typeof(ScheduledTaskService),
                typeof(MonthlyReportsHostedService),
                typeof(DemoMonthlyHostedService)
            },
            hostedTypes);
    }

    private static (bool Enabled, Type[] HostedTypes) Register(string? value)
    {
        var settings = value is null
            ? new Dictionary<string, string?>()
            : new Dictionary<string, string?> { [BackgroundJobRegistration.EnabledSetting] = value };
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        var services = new ServiceCollection();

        var enabled = services.AddOwnersClubBackgroundJobs(configuration);
        var hostedTypes = services
            .Where(descriptor => descriptor.ServiceType == typeof(IHostedService))
            .Select(descriptor => descriptor.ImplementationType)
            .OfType<Type>()
            .ToArray();

        return (enabled, hostedTypes);
    }
}
