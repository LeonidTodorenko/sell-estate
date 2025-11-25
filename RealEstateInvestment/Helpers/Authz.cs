using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Helpers
{
    public static class Authz
    {
        public static bool IsSuperAdmin(this User u, IConfiguration cfg)
            => u.Id == Guid.Parse(cfg["SuperUser:Id"] ?? Guid.Empty.ToString());

        public static bool IsAdmin(this User u)
            => u.UserRole == UserRole.Admin;

        public static bool IsModerator(this User u)
            => u.UserRole == UserRole.Moderator;
    }

}
