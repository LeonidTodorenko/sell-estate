using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using RealEstateInvestment.Data;

namespace RealEstateInvestment.Helpers;

public static class PrivateDataAccess
{
    // Route identifiers are targets, never authenticated actors. Demo targets must
    // match the actor even if a production account happens to have the same UUID.
    public static async Task<IActionResult?> RequireOwnerAsync(
        ClaimsPrincipal actor, AppDbContext db, Guid target, IConfiguration config,
        bool allowAdmin = true)
    {
        if (await FinancialActor.ValidateAsync(actor, db) is { } error) return error;
        if (target == actor.GetUserId()) return null;
        if (allowAdmin && await FinancialAdminAttribute.IsCurrentAdminAsync(actor, db, config)) return null;
        return new ForbidResult();
    }
}
