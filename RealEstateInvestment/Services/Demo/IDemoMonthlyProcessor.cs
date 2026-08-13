namespace RealEstateInvestment.Services.Demo;

public interface IDemoMonthlyProcessor
{
    Task ProcessCurrentMonthAsync(CancellationToken cancellationToken = default);
}
