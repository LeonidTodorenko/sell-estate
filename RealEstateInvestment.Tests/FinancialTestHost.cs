using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using RealEstateInvestment.Controllers;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;

namespace RealEstateInvestment.Tests;

// Does not execute Program.cs, load appsettings, run migrations/hosted jobs, or use network services.
// A new relational in-memory database and real JWT middleware are created for every test.
internal sealed class FinancialTestHost : IDisposable
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    private readonly TestServer server;
    private static readonly SymmetricSecurityKey Key = new(Encoding.UTF8.GetBytes("iteration-six-isolated-test-signing-key-2026-only"));
    public Guid Actor { get; } = Guid.NewGuid();
    public Guid Other { get; } = Guid.NewGuid();
    public Guid Admin { get; } = Guid.NewGuid();
    public Guid Demo { get; } = Guid.NewGuid();
    public Guid DemoOther { get; } = Guid.NewGuid();
    public Guid PropertyId { get; } = Guid.NewGuid();
    public Guid Offer { get; } = Guid.NewGuid();
    public Guid DemoOffer { get; } = Guid.NewGuid();
    public HttpClient Client { get; }
    public IServiceProvider Services => server.Services;

    public FinancialTestHost(Action<IServiceCollection>? configure = null,
        Microsoft.EntityFrameworkCore.Diagnostics.IInterceptor? interceptor = null)
    {
        connection.Open();
        server = new TestServer(new WebHostBuilder().ConfigureServices(services =>
        {
            services.AddDbContext<AppDbContext>(o =>
            {
                o.UseSqlite(connection);
                if (interceptor != null) o.AddInterceptors(interceptor);
            });
            services.AddSingleton<ISuperUserService>(new StubSuperUser(Admin));
            services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
            {
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true, ValidIssuer = "isolated-tests",
                    ValidateAudience = true, ValidAudience = "isolated-tests",
                    ValidateIssuerSigningKey = true, IssuerSigningKey = Key,
                    ValidateLifetime = true, ClockSkew = TimeSpan.Zero
                };
            });
            services.AddAuthorization();
            services.AddControllers().AddApplicationPart(typeof(WithdrawalController).Assembly)
                .AddJsonOptions(o =>
                {
                    // Match the application's existing response settings without invoking its startup.
                    o.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
                    o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
                })
                .AddControllersAsServices();
            // TopUp no longer needs its external-service dependencies. Never instantiate them in tests.
            services.AddTransient<UserController>(sp => new UserController(
                sp.GetRequiredService<AppDbContext>(), null!, null!, null!, null!));
            services.AddTransient<KycController>(sp => new KycController(sp.GetRequiredService<AppDbContext>(), null!));
            services.AddTransient<PropertyController>(sp => new PropertyController(
                sp.GetRequiredService<AppDbContext>(), null!, null!, null!));
            configure?.Invoke(services);
        }).Configure(app =>
        {
            app.UseRouting();
            app.UseAuthentication();
            app.UseAuthorization();
            app.UseEndpoints(e => e.MapControllers());
        }));
        Client = server.CreateClient();
        WithDb(db =>
        {
            db.Database.EnsureCreated();
            db.Users.AddRange(Normal(Actor, "1111"), Normal(Other, "2222"), Normal(Admin, "3333", "admin"));
            db.DemoUsers.AddRange(Sandbox(Demo, "4444"), Sandbox(DemoOther, "5555"));
            db.Properties.Add(new Property
            {
                Id = PropertyId, Title = "Isolated fixture", Location = "Test", Price = 1000,
                TotalShares = 100, AvailableShares = 80, ApplicationDeadline = DateTime.UtcNow.AddDays(10),
                LastPayoutDate = DateTime.UtcNow.AddDays(-40), BuybackPricePerShare = 10,
                PaymentPlans = new List<PaymentPlan> { new() { PropertyId = PropertyId,
                    EventDate = DateTime.UtcNow.AddDays(-1), DueDate = DateTime.UtcNow.AddDays(1), Total = 1000 } }
            });
            db.Investments.Add(new Investment { UserId = Actor, PropertyId = PropertyId, Shares = 10, InvestedAmount = 100 });
            db.DemoInvestments.Add(new DemoInvestment { DemoUserId = Demo, PropertyId = PropertyId, Shares = 10, InvestedAmount = 100 });
            db.ShareOffers.Add(new ShareOffer { Id = Offer, SellerId = Other, PropertyId = PropertyId,
                SharesForSale = 2, StartPricePerShare = 10, BuyoutPricePerShare = 10,
                LockedInvestedAmount = 20, ExpirationDate = DateTime.UtcNow.AddDays(2) });
            db.DemoShareOffers.Add(new DemoShareOffer { Id = DemoOffer, DemoSellerId = DemoOther, PropertyId = PropertyId,
                SharesForSale = 2, StartPricePerShare = 10, BuyoutPricePerShare = 10,
                LockedInvestedAmount = 20, ExpirationDate = DateTime.UtcNow.AddDays(2) });
            db.SaveChanges();
        });
    }

    public void Login(Guid? id, bool demo = false, string role = "investor", string? identity = null)
    {
        if (id == null) { Client.DefaultRequestHeaders.Authorization = null; return; }
        var jwt = new JwtSecurityToken("isolated-tests", "isolated-tests", new[]
        {
            new Claim(ClaimTypes.NameIdentifier, identity ?? id.ToString()!),
            new Claim(ClaimTypes.Role, role), new Claim("isDemo", demo ? "true" : "false")
        }, expires: DateTime.UtcNow.AddMinutes(5), signingCredentials: new SigningCredentials(Key, SecurityAlgorithms.HmacSha256));
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(jwt));
    }

    public void WithDb(Action<AppDbContext> action)
    {
        using var scope = server.Services.CreateScope();
        action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }
    private static User Normal(Guid id, string pin, string role = "investor") => new()
    {
        Id = id, FullName = "Test", Email = $"{id}@example.invalid", ClientNumber = id.ToString(),
        PasswordHash = "plain-" + pin, SecretWord = "test", PinCode = pin,
        IsEmailConfirmed = true, WalletBalance = 1000, Role = role,
        UserRole = role == "admin" ? UserRole.Admin : UserRole.Investor
    };
    private static DemoUser Sandbox(Guid id, string pin) => new()
    {
        Id = id, DemoCode = id.ToString(), Email = $"{id}@example.invalid", ClientNumber = id.ToString(),
        PasswordHash = PasswordHasher.HashPassword("demo-" + pin), PinCode = pin,
        WalletBalance = 1000, ExpiresAt = DateTime.UtcNow.AddDays(5)
    };
    public void Dispose() { Client.Dispose(); server.Dispose(); connection.Dispose(); }
    private sealed class StubSuperUser(Guid id) : ISuperUserService
    {
        public Guid GetSuperUserId() => id;
        public Task EnsureSuperUserExistsAsync() => Task.CompletedTask;
    }
}
