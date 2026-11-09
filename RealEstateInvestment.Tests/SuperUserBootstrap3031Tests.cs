using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Npgsql;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using Xunit;

namespace RealEstateInvestment.Tests;

[Collection("Ledger292Postgres")]
public sealed class SuperUserBootstrap3031Tests
{
    [Local292Fact]
    public async Task Empty_Postgres_migrates_and_bootstraps_unique_admin_once_without_changing_users()
    {
        var connection = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable("QA292_DB")!);
        if (connection.Host != "127.0.0.1" || connection.Port != 15433 || connection.Database != "qa292_isolated")
            throw new InvalidOperationException("Requires local isolated PostgreSQL fixture");
        var database = "qa3031_" + Guid.NewGuid().ToString("N");
        connection.Database = "postgres";
        await using var control = new NpgsqlConnection(connection.ConnectionString);
        await control.OpenAsync();
        await using (var create = new NpgsqlCommand($"CREATE DATABASE {database}", control))
            await create.ExecuteNonQueryAsync();
        try
        {
            connection.Database = database;
            connection.Pooling = false;
            await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(connection.ConnectionString).Options);
            await db.Database.MigrateAsync();
            Assert.Empty(await db.Users.ToListAsync());
            var id = Guid.NewGuid();
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["SuperUser:Id"] = id.ToString(),
                ["SuperUser:Bootstrap:Email"] = "bootstrap@example.invalid",
                ["SuperUser:Bootstrap:Password"] = "Local-test-only!3031",
                ["SuperUser:Bootstrap:SecretWord"] = "fixture"
            }).Build();
            var service = new SuperUserService(config, db, new DevelopmentEnvironment());
            await service.EnsureSuperUserExistsAsync();
            var admin = await db.Users.AsNoTracking().SingleAsync();
            Assert.Equal(id, admin.Id);
            Assert.Matches("^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{9}$", admin.ClientNumber);
            Assert.Equal("admin", admin.Role);
            Assert.Equal(0m, admin.WalletBalance);
            Assert.Single(await db.ActionLogs.ToListAsync());

            var other = new User { Id = Guid.NewGuid(), Email = "existing@example.invalid",
                FullName = "Existing investor", ClientNumber = "EXISTING9", PasswordHash = "keep",
                SecretWord = "keep", WalletBalance = 123m };
            db.Users.Add(other);
            await db.SaveChangesAsync();
            await service.EnsureSuperUserExistsAsync();
            config["SuperUser:Id"] = Guid.NewGuid().ToString();
            config["SuperUser:Bootstrap:Email"] = "second@example.invalid";
            await service.EnsureSuperUserExistsAsync();
            db.ChangeTracker.Clear();
            var users = await db.Users.AsNoTracking().ToListAsync();
            Assert.Equal(3, users.Count);
            Assert.Equal(3, users.Select(u => u.ClientNumber).Distinct().Count());
            Assert.Equal(admin.ClientNumber, users.Single(u => u.Id == id).ClientNumber);
            var preserved = users.Single(u => u.Id == other.Id);
            Assert.Equal("EXISTING9", preserved.ClientNumber);
            Assert.Equal(123m, preserved.WalletBalance);
            Assert.Equal("keep", preserved.PasswordHash);
            Assert.Equal(2, await db.ActionLogs.CountAsync());
        }
        finally
        {
            await using var drop = new NpgsqlCommand($"DROP DATABASE {database} WITH (FORCE)", control);
            await drop.ExecuteNonQueryAsync();
        }
    }

    private sealed class DevelopmentEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "Bootstrap3031Tests";
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
