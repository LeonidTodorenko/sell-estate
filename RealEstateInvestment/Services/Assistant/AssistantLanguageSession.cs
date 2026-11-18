using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.JsonWebTokens;

namespace RealEstateInvestment.Services.Assistant;

public sealed class AssistantLanguageSession : IDisposable
{
    private readonly MemoryCache preferences = new(new MemoryCacheOptions { SizeLimit = 4096 });

    internal (bool Russian, bool Changed) Resolve(HttpContext context, string question)
    {
        var bearer = context.Request.Headers.Authorization.ToString()[7..].Trim();
        var session = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(bearer)));
        var command = question.Trim().TrimEnd('.', '!', '?').ToLowerInvariant();
        switch (command)
        {
            case "отвечай по-русски":
            case "please answer in russian":
            case "answer in russian":
                var token = new JsonWebToken(bearer);
                preferences.Set(session, true, new MemoryCacheEntryOptions
                {
                    Size = 1,
                    AbsoluteExpiration = new DateTimeOffset(token.ValidTo, TimeSpan.Zero)
                });
                return (true, true);
            case "отвечай по-английски":
            case "please answer in english":
            case "answer in english":
                preferences.Remove(session);
                return (false, true);
            default:
                return (preferences.TryGetValue<bool>(session, out var russian) && russian, false);
        }
    }

    public void Dispose() => preferences.Dispose();
}