using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using RealEstateInvestment.Controllers;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services.Assistant;

namespace RealEstateInvestment.Tests;

internal sealed class AssistantTestHost : IDisposable
{
    private const string Issuer = "isolated-tests";
    private static readonly SymmetricSecurityKey Key = new(Encoding.UTF8.GetBytes("assistant-local-test-signing-key-only"));
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    private readonly IWebHost host;

    public Guid Actor { get; } = Guid.NewGuid();
    public Guid Other { get; } = Guid.NewGuid();
    public Guid Admin { get; } = Guid.NewGuid();
    public Guid Demo { get; } = Guid.NewGuid();
    public Guid PropertyId { get; } = Guid.NewGuid();
    public HttpClient Client { get; }

    public AssistantTestHost(Action<IServiceCollection>? configure = null,
        IInterceptor? interceptor = null, string? isolatedPostgres = null)
    {
        if (isolatedPostgres != null)
        {
            var address = new Npgsql.NpgsqlConnectionStringBuilder(isolatedPostgres);
            if (address.Host != "127.0.0.1" || address.Port is not (15433 or 15439) || address.Database != "qa292_isolated")
                throw new InvalidOperationException("The assistant test requires the dedicated local fixture database.");
        }
        else
        {
            connection.Open();
        }

        // Bind only the ephemeral loopback server. The production startup and jobs never run.
        host = new WebHostBuilder().UseKestrel(options => options.Listen(System.Net.IPAddress.Loopback, 0))
            .ConfigureServices(services =>
            {
                services.AddDbContext<AppDbContext>(options =>
                {
                    if (isolatedPostgres == null) options.UseSqlite(connection);
                    else options.UseNpgsql(isolatedPostgres);
                    if (interceptor != null) options.AddInterceptors(interceptor);
                });
                services.AddOwnersClubAssistant(Key, Issuer, Issuer);
                services.AddControllers().AddApplicationPart(typeof(AssistantController).Assembly);
                configure?.Invoke(services);
            })
            .Configure(app =>
            {
                app.UseRouting();
                app.UseAuthentication();
                app.UseAuthorization();
                app.UseRateLimiter();
                app.UseRequestTimeouts();
                app.UseEndpoints(endpoints => endpoints.MapControllers());
            }).Start();

        var addresses = host.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!;
        Client = new HttpClient { BaseAddress = new Uri(addresses.Addresses.Single()) };

        WithDb(db =>
        {
            db.Database.EnsureCreated();
            db.Users.AddRange(Account(Actor), Account(Other), Account(Admin));
            db.DemoUsers.Add(new DemoUser
            {
                Id = Demo, DemoCode = Demo.ToString(), Email = $"{Demo}@example.invalid",
                ClientNumber = Demo.ToString(), PasswordHash = "fixture-only", IsActive = true
            });
            db.Properties.Add(new Property
            {
                Id = PropertyId, Title = "Isolated fixture", Location = "Test", Price = 1000,
                TotalShares = 100, AvailableShares = 80, ApplicationDeadline = DateTime.UtcNow.AddDays(1)
            });
            db.Investments.Add(new Investment { UserId = Actor, PropertyId = PropertyId, Shares = 10, InvestedAmount = 100 });
            db.DemoInvestments.Add(new DemoInvestment { DemoUserId = Demo, PropertyId = PropertyId, Shares = 10, InvestedAmount = 100 });
            db.SaveChanges();
        });
    }

    public void Login(Guid id, bool demo = false, string role = "investor", string? identity = null,
        string issuer = Issuer, string audience = Issuer, DateTime? expires = null)
    {
        var jwt = new JwtSecurityToken(issuer, audience, new[]
        {
            new Claim(ClaimTypes.NameIdentifier, identity ?? id.ToString()),
            new Claim(ClaimTypes.Role, role), new Claim("isDemo", demo ? "true" : "false"),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
        }, expires: expires ?? DateTime.UtcNow.AddMinutes(5), signingCredentials: new SigningCredentials(Key, SecurityAlgorithms.HmacSha256));
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(jwt));
    }

    public void WithDb(Action<AppDbContext> action)
    {
        using var scope = host.Services.CreateScope();
        action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    private static User Account(Guid id) => new()
    {
        Id = id, FullName = "Test", Email = $"{id}@example.invalid", ClientNumber = id.ToString(),
        PasswordHash = "fixture-only", SecretWord = "fixture", IsEmailConfirmed = true, WalletBalance = 1000
    };

    public void Dispose()
    {
        Client.Dispose();
        host.Dispose();
        connection.Dispose();
    }
}
