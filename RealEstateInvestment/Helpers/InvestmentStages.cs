using RealEstateInvestment.Models;

namespace RealEstateInvestment.Helpers;

// Stable numbering shared by quoting, submission and manual decisions.
internal static class InvestmentStages
{
    public static List<PaymentPlan> Ordered(IEnumerable<PaymentPlan>? plans) => (plans ?? Enumerable.Empty<PaymentPlan>())
        .OrderBy(x => x.EventDate.HasValue ? 0 : 1).ThenBy(x => x.EventDate).ThenBy(x => x.DueDate).ThenBy(x => x.Id).ToList();
    public static PaymentPlan? Active(List<PaymentPlan> plans, DateTime now) => plans
        .FirstOrDefault(x => x.EventDate <= now && now <= x.DueDate);
}
