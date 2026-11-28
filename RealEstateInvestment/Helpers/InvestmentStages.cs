using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Helpers;

// Stable numbering shared by quoting, submission and manual decisions.
internal static class InvestmentStages
{
    public static List<PaymentPlan> Ordered(IEnumerable<PaymentPlan>? plans) => (plans ?? Enumerable.Empty<PaymentPlan>())
        .OrderBy(x => x.EventDate.HasValue ? 0 : 1).ThenBy(x => x.EventDate).ThenBy(x => x.DueDate).ThenBy(x => x.Id).ToList();
    public static PaymentPlan? Active(List<PaymentPlan> plans, DateTime now) => plans
        .FirstOrDefault(x => x.EventDate <= now && now <= x.DueDate);

    public static async Task<int> DemoAvailableSharesAsync(AppDbContext db, Property property)
    {
        var allocated = await db.DemoInvestments.Where(x => x.PropertyId == property.Id).SumAsync(x => (int?)x.Shares) ?? 0;
        var pending = await db.DemoInvestmentApplications
            .Where(x => x.PropertyId == property.Id && x.Status == "pending")
            .SumAsync(x => (int?)x.RequestedShares) ?? 0;
        // Active offers are already removed from DemoInvestments when listed, so add them back
        // to allocated ownership; they must not create artificial free capacity.
        var locked = await db.DemoShareOffers
            .Where(x => x.PropertyId == property.Id && x.IsActive)
            .SumAsync(x => (int?)x.SharesForSale) ?? 0;
        return Math.Max(0, property.TotalShares - allocated - pending - locked);
    }
}
