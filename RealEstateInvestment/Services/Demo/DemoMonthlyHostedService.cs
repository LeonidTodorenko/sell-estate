namespace RealEstateInvestment.Services.Demo;

public sealed class DemoMonthlyHostedService : BackgroundService
{
    private static readonly TimeSpan RunInterval = TimeSpan.FromHours(6);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DemoMonthlyHostedService> _logger;

    public DemoMonthlyHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<DemoMonthlyHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Demo monthly scheduler started; it runs immediately and then every {RunInterval}",
            RunInterval);

        await RunOnceAsync(stoppingToken);

        using var timer = new PeriodicTimer(RunInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
            await RunOnceAsync(stoppingToken);
    }

    private async Task RunOnceAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var processor = scope.ServiceProvider.GetRequiredService<IDemoMonthlyProcessor>();
            await processor.ProcessCurrentMonthAsync(cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Normal application shutdown.
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Demo monthly scheduler run failed; the next interval will retry safely");
        }
    }
}
