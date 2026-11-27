using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Memory;

namespace RealEstateInvestment.Services.Assistant;

public sealed record AssistantTurn(string Question, string Answer);

public sealed class AssistantLanguageSession : IDisposable
{
    private readonly MemoryCache conversations = new(new MemoryCacheOptions { SizeLimit = 1024 });
    private readonly object gate = new();
    private readonly MemoryCache market = new(new MemoryCacheOptions { SizeLimit = 1 });

    internal T CachedMarket<T>(IConfiguration config, DateOnly today, Func<T> read)
    {
        lock (gate)
        {
            return market.GetOrCreate(today, entry =>
            {
                entry.Size = 1;
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15);
                entry.AddExpirationToken(config.GetReloadToken());
                return read();
            })!;
        }
    }

    internal sealed class Conversation
    {
        public SemaphoreSlim Slot { get; } = new(1, 1);
        public bool Russian { get; set; }
        public bool LanguageSelected { get; set; }
        internal ScenarioContext? Scenario { get; set; }
        public string? AccountTopic { get; set; }
        public IReadOnlyList<string> LastSourceSections { get; set; } = [];
        public List<AssistantTurn> Turns { get; } = [];
    }

    internal (Guid Id, Conversation Conversation) Open(HttpContext context, Guid? id)
    {
        var owner = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
            context.Request.Headers.Authorization.ToString())));
        lock (gate)
        {
            if (id is { } existing && conversations.TryGetValue<Conversation>((owner, existing), out var found))
                return (existing, found!);
            var created = Guid.NewGuid();
            var conversation = new Conversation();
            conversations.Set((owner, created), conversation, new MemoryCacheEntryOptions
            {
                Size = 1,
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30)
            });
            return (created, conversation);
        }
    }

    internal static bool? LanguageCommand(string question) => question.Trim().TrimEnd('.', '!', '?').ToLowerInvariant() switch
    {
        "отвечай по-русски" or "please answer in russian" or "answer in russian" => true,
        "отвечай по-английски" or "please answer in english" or "answer in english" => false,
        _ => null
    };

    public void Dispose()
    {
        conversations.Dispose();
        market.Dispose();
    }
}
