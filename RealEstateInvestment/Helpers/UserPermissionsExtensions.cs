using RealEstateInvestment.Enums;

namespace RealEstateInvestment.Helpers
{
    public static class UserPermissionsExtensions
    {
        public static bool Has(this PermissionFlags flags, PermissionFlags need)
            => (flags & need) == need;
    }

}
