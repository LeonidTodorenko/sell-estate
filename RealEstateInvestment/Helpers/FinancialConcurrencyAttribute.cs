using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace RealEstateInvestment.Helpers;

// SaveChanges rolls back its transaction/savepoint when a guarded row changed concurrently.
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class FinancialConcurrencyAttribute : ExceptionFilterAttribute
{
    public override void OnException(ExceptionContext context)
    {
        if (context.Exception is not DbUpdateConcurrencyException &&
            !IsSerializationFailure(context.Exception)) return;
        context.Result = new ConflictObjectResult(new { message = "Financial state changed. Reload before retrying." });
        context.ExceptionHandled = true;
    }

    private static bool IsSerializationFailure(Exception? exception) => exception != null &&
        (exception is PostgresException { SqlState: "40001" or "40P01" } ||
         IsSerializationFailure(exception.InnerException));
}
