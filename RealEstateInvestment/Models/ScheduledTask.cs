namespace RealEstateInvestment.Models
{
    public class ScheduledTask
    {
        public Func<IServiceProvider, Task> Action { get; set; } = default!;
        public TimeSpan Interval { get; set; }
        public DateTime LastRunTime { get; set; } = DateTime.MinValue;
    }
}
