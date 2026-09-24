using System.Security.Claims;
using System.Diagnostics.CodeAnalysis;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Helpers;

public static class FinancialActor
{
    public static bool IsEligible([NotNullWhen(true)] DemoUser? user) => user != null && user.IsActive &&
        !user.IsTemplate && !user.IsBlocked && user.IsDeleted != true &&
        (!user.ExpiresAt.HasValue || user.ExpiresAt.Value > DateTime.UtcNow);

    public static bool VerifyDemoSecret(DemoUser user, string? secret) =>
        !string.IsNullOrWhiteSpace(secret) &&
        ((!string.IsNullOrEmpty(user.PinCode) && secret == user.PinCode) ||
         PasswordHasher.VerifyPassword(secret, user.PasswordHash));

    // Validate the authenticated identity before choosing a production or sandbox branch.
    // Normal User has no IsActive/ExpiresAt fields; do not invent new eligibility rules.
    public static async Task<IActionResult?> ValidateAsync(ClaimsPrincipal principal, AppDbContext db)
    {
        var id = principal.GetUserId();
        if (principal.Identity?.IsAuthenticated != true || id == Guid.Empty)
            return new UnauthorizedResult();
        if (principal.IsDemo())
            return IsEligible(await db.DemoUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id)) ? null : new UnauthorizedResult();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        return user != null && !user.IsBlocked && user.IsDeleted != true && user.IsEmailConfirmed
            ? null : new ForbidResult();
    }
}
