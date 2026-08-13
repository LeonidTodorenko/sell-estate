using System.Security.Claims;

namespace RealEstateInvestment.Helpers
{
    public static class ClaimsPrincipalExtensions
    {
        public static Guid GetUserId(this ClaimsPrincipal user)
        {
            var userIdString = user.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(userIdString, out var userId) ? userId : Guid.Empty;
        }

        public static bool IsDemo(this ClaimsPrincipal user)
        {
            return string.Equals(user.FindFirstValue("isDemo"), "true", StringComparison.OrdinalIgnoreCase);
        }

        public static Guid ResolveRequestedUserId(this ClaimsPrincipal user, Guid requestedUserId)
        {
            return user.IsDemo() ? user.GetUserId() : requestedUserId;
        }
    }
}
