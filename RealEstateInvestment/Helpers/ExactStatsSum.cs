using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RealEstateInvestment.Data;

namespace RealEstateInvestment.Helpers;

public static class ExactStatsSum
{
    // Fixed SQL only. Preserve PostgreSQL numeric precision through JSON serialization.
    public static async Task<object> InvestmentsAsync(AppDbContext db) => db.Database.IsNpgsql()
        ? await ReadAsync(db, "SELECT COALESCE(SUM(\"InvestedAmount\"), 0)::text FROM \"Investments\"")
        : (object)(await db.Investments.SumAsync(x => (decimal?)x.InvestedAmount) ?? 0m);
    public static async Task<object> RentAsync(AppDbContext db) => db.Database.IsNpgsql()
        ? await ReadAsync(db, "SELECT COALESCE(SUM(\"Amount\"), 0)::text FROM \"RentalIncomes\"")
        : (object)(await db.RentalIncomes.SumAsync(x => (decimal?)x.Amount) ?? 0m);
    private static async Task<object> ReadAsync(AppDbContext db, string sql)
    {
        var connection = db.Database.GetDbConnection();
        var opened = connection.State != ConnectionState.Open;
        if (opened) await db.Database.OpenConnectionAsync();
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = sql;
            command.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
            var number = (string)(await command.ExecuteScalarAsync())!;
            using var document = JsonDocument.Parse(number);
            if (document.RootElement.ValueKind != JsonValueKind.Number)
                throw new InvalidOperationException("Financial aggregate is not a finite JSON number.");
            return document.RootElement.Clone();
        }
        finally { if (opened) await db.Database.CloseConnectionAsync(); }
    }
}
