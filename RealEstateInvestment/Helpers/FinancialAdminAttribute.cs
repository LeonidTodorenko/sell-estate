using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;

namespace RealEstateInvestment.Helpers;

// SuperUserService creates the configured SuperAdmin with JWT role "admin".
// Require both a role claim and a current production account; demo claims never grant admin access.
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class FinancialAdminAttribute : AuthorizeAttribute, IAsyncAuthorizationFilter
{
    public FinancialAdminAttribute() => Roles = "admin";

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var principal = context.HttpContext.User;
        if (principal.Identity?.IsAuthenticated != true || principal.GetUserId() == Guid.Empty)
        {
            context.Result = new UnauthorizedResult();
            return;
        }
        if (principal.IsDemo() || !principal.IsInRole("admin"))
        {
            context.Result = new ForbidResult();
            return;
        }
        var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var config = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        if (!await IsCurrentAdminAsync(principal, db, config))
            context.Result = new ForbidResult();
    }

    public static async Task<bool> IsCurrentAdminAsync(System.Security.Claims.ClaimsPrincipal principal,
        AppDbContext db, IConfiguration config)
    {
        if (principal.Identity?.IsAuthenticated != true || principal.IsDemo() || !principal.IsInRole("admin"))
            return false;
        var id = principal.GetUserId();
        if (id == Guid.Empty) return false;
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        return user != null && !user.IsBlocked && user.IsDeleted != true &&
            (user.Role == "admin" || user.IsSuperAdmin(config));
    }
}
