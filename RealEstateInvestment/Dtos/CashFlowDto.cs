namespace RealEstateInvestment.Dtos
{
    public class CashFlowLineItemDto
    {
        public DateTime Date { get; set; }               // ключевая дата (DueDate дня/месяца)
        public Guid? PropertyId { get; set; }
        public string? PropertyTitle { get; set; }
        public string Kind { get; set; } = "";           // "Outflow:PaymentPlan" | "Inflow:Rent" | "Inflow:Sale" | "Inflow:User"
        public string Label { get; set; } = "";          // Milestone или пояснение
        public decimal Amount { get; set; }              // + для притока, - для оттока
    }

    public class CashFlowPeriodSummaryDto
    {
        public DateTime Period { get; set; }             // например, первый день месяца
        public decimal RequiredOutflow { get; set; }     // сумма по планам (отток, положительное число)
        public decimal AvailableOnDate { get; set; }     // баланс + прогнозные притоки до этой даты
        public decimal Shortfall { get; set; }           // max(0, RequiredOutflow - AvailableOnDate)
        public List<CashFlowLineItemDto> Items { get; set; } = new();
    }

    public class CashFlowForecastDto
    {
        public decimal SuperUserBalance { get; set; }    // текущий
        public List<CashFlowPeriodSummaryDto> Periods { get; set; } = new();
    }

}
