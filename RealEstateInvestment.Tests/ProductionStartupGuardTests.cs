using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using Xunit;

namespace RealEstateInvestment.Tests;

public sealed class ProductionStartupGuardTests
{
    [Fact]
    public void Production_configuration_rejects_missing_required_settings_without_values()
    {
        var configuration = Configuration(new Dictionary<string, string?>());
        var error = Assert.Throws<InvalidOperationException>(() =>
            ProductionStartupGuard.Validate(configuration, Environment("Production")));

        Assert.Contains("ConnectionStrings:DefaultConnection", error.Message);
        Assert.Contains("Jwt:Key", error.Message);
        Assert.DoesNotContain("Password=", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Nonproduction_configuration_does_not_require_production_secrets()
    {
        ProductionStartupGuard.Validate(
            Configuration(new Dictionary<string, string?>()),
            Environment("Development"));
    }

    [Fact]
    public void Production_configuration_accepts_complete_contract_and_trim_is_non_destructive()
    {
        var settings = ValidProductionSettings();
        settings["Resend:ApiKey"] = "  key-containing-test-text  ";
        var configuration = Configuration(settings);

        ProductionStartupGuard.Validate(configuration, Environment("Production"));

        Assert.Equal("  key-containing-test-text  ", configuration["Resend:ApiKey"]);
    }

    [Fact]
    public async Task Existing_configured_production_superuser_is_left_unchanged()
    {
        await using var fixture = await SuperUserFixture.CreateAsync(existing: true);
        var before = await fixture.Db.Users.AsNoTracking().SingleAsync();

        await fixture.Service.EnsureSuperUserExistsAsync();

        var after = await fixture.Db.Users.AsNoTracking().SingleAsync();
        Assert.Equal(before.Email, after.Email);
        Assert.Equal(before.WalletBalance, after.WalletBalance);
        Assert.Empty(await fixture.Db.ActionLogs.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task Missing_configured_production_superuser_fails_without_creating_or_funding_account()
    {
        await using var fixture = await SuperUserFixture.CreateAsync(existing: false);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(
            () => fixture.Service.EnsureSuperUserExistsAsync());

        Assert.Contains("Automatic production admin creation is disabled", error.Message);
        Assert.Empty(await fixture.Db.Users.AsNoTracking().ToListAsync());
        Assert.Empty(await fixture.Db.ActionLogs.AsNoTracking().ToListAsync());
    }

    private static Dictionary<string, string?> ValidProductionSettings() => new()
    {
        ["ConnectionStrings:DefaultConnection"] = "Host=example.invalid",
        ["Jwt:Key"] = "local-test-signing-key-that-is-not-a-secret",
        ["Jwt:Issuer"] = "test-issuer",
        ["Jwt:Audience"] = "test-audience",
        ["Resend:ApiKey"] = "local-test-api-key",
        ["SuperUser:Id"] = Guid.NewGuid().ToString(),
        ["App:UploadsRoot"] = "test-uploads",
        ["Firebase:CredentialsPath"] = "test-credentials.json"
    };

    private static IConfiguration Configuration(Dictionary<string, string?> settings) =>
        new ConfigurationBuilder().AddInMemoryCollection(settings).Build();

    private static IHostEnvironment Environment(string name) => new TestHostEnvironment
    {
        EnvironmentName = name
    };

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";
        public string ApplicationName { get; set; } = "RealEstateInvestment.Tests";
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private sealed class SuperUserFixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public AppDbContext Db { get; }
        public SuperUserService Service { get; }

        private SuperUserFixture(SqliteConnection connection, AppDbContext db, SuperUserService service) =>
            (this.connection, Db, Service) = (connection, db, service);

        public static async Task<SuperUserFixture> CreateAsync(bool existing)
        {
            var id = Guid.NewGuid();
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
            var db = new AppDbContext(options);
            await db.Database.EnsureCreatedAsync();

            if (existing)
            {
                db.Users.Add(new User
                {
                    Id = id,
                    FullName = "Configured Admin",
                    Email = "configured@example.invalid",
                    ClientNumber = id.ToString(),
                    PasswordHash = "existing-value",
                    SecretWord = "existing-value",
                    Role = "admin",
                    IsEmailConfirmed = true,
                    WalletBalance = 42
                });
                await db.SaveChangesAsync();
            }

            var configuration = Configuration(new Dictionary<string, string?>
            {
                ["SuperUser:Id"] = id.ToString()
            });
            var service = new SuperUserService(configuration, db, Environment("Production"));
            return new SuperUserFixture(connection, db, service);
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
