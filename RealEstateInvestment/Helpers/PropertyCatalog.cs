using RealEstateInvestment.Models;

namespace RealEstateInvestment.Helpers;

public static class PropertyCatalog
{
    // Confirmed fixtures from the 30.4.1 QA run. Keep their accounting and audit intact.
    private static readonly Guid[] TechnicalPropertyIds =
    [
        new("668a36b8-01f5-4d4f-9d94-971b2b085b8b"),
        new("9dfe8533-325c-4174-a920-2759674fb92e")
    ];

    public static bool IsTechnicalFixture(Guid id) => TechnicalPropertyIds.Contains(id);

    public static IQueryable<Property> ExcludeTechnicalFixtures(this IQueryable<Property> properties) =>
        properties.Where(property => !TechnicalPropertyIds.Contains(property.Id));
}
