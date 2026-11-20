using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.IdentityModel.Tokens;
using RealEstateInvestment.Helpers;

namespace RealEstateInvestment.Services.Assistant;

public static class AssistantRegistration
{
    public const string Policy = "ownersclub-assistant";
    public const string AskTimeoutPolicy = "ownersclub-assistant-ask";
    public const string JwtScheme = "assistant-jwt";

    public static IServiceCollection AddOwnersClubAssistant(this IServiceCollection services,
        SymmetricSecurityKey? signingKey, string issuer, string audience, IConfiguration? configuration = null)
    {
        services.AddAuthentication().AddJwtBearer(JwtScheme, options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = issuer,
                ValidateAudience = true,
                ValidAudience = audience,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = signingKey,
                ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
                ClockSkew = TimeSpan.Zero
            };
        });
        services.AddAuthorization(options => options.AddPolicy(Policy, policy =>
            policy.AddAuthenticationSchemes(JwtScheme).RequireAuthenticatedUser()
                .RequireRole("investor").RequireClaim("isDemo", "true", "false")));
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(Policy, context => RateLimitPartition.GetFixedWindowLimiter(
                (context.User.IsDemo(), context.User.GetUserId()), _ => new()
                {
                    PermitLimit = 12,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0
                }));
        });
        var geminiTimeout = TimeSpan.FromMilliseconds(Math.Clamp(
            configuration?.GetValue<int?>("Assistant:Gemini:TimeoutMs") ?? 12000, 500, 15000));
        var requestTimeout = TimeSpan.FromMilliseconds(Math.Clamp(
            configuration?.GetValue<int?>("Assistant:RequestTimeoutMs") ?? 15000,
            (int)geminiTimeout.TotalMilliseconds + 2000, 18000));
        services.AddRequestTimeouts(options =>
        {
            options.AddPolicy(Policy, TimeSpan.FromSeconds(5));
            options.AddPolicy(AskTimeoutPolicy, requestTimeout);
        });
        services.AddSingleton<AssistantKnowledge>();
        services.AddSingleton<AssistantLanguageSession>();
        services.AddSingleton(sp =>
        {
            var settings = sp.GetRequiredService<IConfiguration>();
            var enabled = settings.GetValue<bool>("Assistant:Gemini:Enabled");
            var freeTierConfirmed = settings.GetValue<bool>("Assistant:Gemini:FreeTierConfirmed");
            var key = enabled && freeTierConfirmed ? Environment.GetEnvironmentVariable("GEMINI_API_KEY") : null;
            var http = new HttpClient(new SocketsHttpHandler
            {
                AllowAutoRedirect = false,
                UseCookies = false,
                UseProxy = false,
                PooledConnectionLifetime = TimeSpan.FromMinutes(5),
                ActivityHeadersPropagator = null
            });
            return new GeminiFaqAdapter(http, key, TimeProvider.System, geminiTimeout);
        });
        services.AddSingleton<IAssistantConversationProvider>(sp => sp.GetRequiredService<GeminiFaqAdapter>());
        return services;
    }
}
