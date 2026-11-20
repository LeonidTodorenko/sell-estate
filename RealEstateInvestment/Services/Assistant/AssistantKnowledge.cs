using System.Text.RegularExpressions;

namespace RealEstateInvestment.Services.Assistant;

public sealed record AssistantAnswer(string Status, string Version, string? Topic, string Answer, IReadOnlyList<string> Sources)
{
    internal IReadOnlyList<string> SourceSections { get; init; } = [];
    public IReadOnlyList<AssistantSource> SourceLinks { get; init; } = [];
    public string? TraceId { get; init; }
    public Guid? ConversationId { get; init; }
    public string Language { get; init; } = "en";
}

public sealed class AssistantKnowledge
{
    private sealed record Entry(string Topic, string Group, string Russian, string English, string[] Sources);
    private sealed record Alias(Entry Entry, HashSet<string> Terms);

    public const string Version = "30.7.3";
    private const double MinimumScore = 0.80;
    private readonly Dictionary<string, Alias> aliases = new(StringComparer.Ordinal);
    private static readonly Regex Allowed = new(@"^[a-zа-яё0-9 .?!,\-]+$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex Words = new(@"[a-zа-я0-9]+", RegexOptions.CultureInvariant);
    private static readonly Regex LeadIn = new(
        @"^(?:(?:please )?(?:explain|show me|tell me about)|(?:could|can) you tell me about|(?:what is|what are|where is|how does|how do i|how can i)|(?:что такое|расскажите про|как работает|где посмотреть)) ",
        RegexOptions.CultureInvariant);


    public AssistantKnowledge()
    {
        using var stream = typeof(AssistantKnowledge).Assembly.GetManifestResourceStream("OwnersClub.Assistant.Faq")
            ?? throw new InvalidOperationException("Assistant FAQ resource is missing.");
        using var reader = new StreamReader(stream);
        var topics = new HashSet<string>(StringComparer.Ordinal);
        foreach (var section in reader.ReadToEnd().ReplaceLineEndings("\n").Split("\n## ").Skip(1))
        {
            var lines = section.Trim().Split('\n');
            if (lines.Length != 7 || !topics.Add(lines[0]) || !lines[1].StartsWith("Group: ", StringComparison.Ordinal)
                || !lines[2].StartsWith("RU: ", StringComparison.Ordinal) || !lines[3].StartsWith("EN: ", StringComparison.Ordinal)
                || string.IsNullOrWhiteSpace(lines[4]) || string.IsNullOrWhiteSpace(lines[5])
                || !lines[6].StartsWith("Sources: ", StringComparison.Ordinal))
                throw new InvalidOperationException("Invalid assistant FAQ entry.");

            var entry = new Entry(lines[0], lines[1][7..], lines[4], lines[5], lines[6][9..].Split(" | ").Select(SourcePath).ToArray());
            foreach (var variant in (lines[2][4..] + " | " + lines[3][4..]).Split(" | "))
            {
                var text = Normalize(variant);
                if (text.Length == 0 || (aliases.TryGetValue(text, out var previous) && previous.Entry != entry))
                    throw new InvalidOperationException("Empty or ambiguous assistant FAQ alias.");
                aliases[text] = new(entry, Terms(text));
            }
        }
    }

    public AssistantAnswer Search(string question) => Match(question).Answer;

    internal (AssistantAnswer Answer, bool Exact, bool Russian) Match(string question, bool russian = false)
    {

        var unknown = new AssistantAnswer("unknown", Version, null, russian
            ? "В базе нет подтверждённого ответа. Попробуйте задать один общий вопрос о функциях OwnersClub."
            : "I can help with OwnersClub features like properties, payment plans, investments, and your account. What would you like to know about one of those?", Array.Empty<string>());
        var trimmed = question.Trim(' ');
        if (trimmed.Length is 0 or > 400 || !Allowed.IsMatch(trimmed) || trimmed.Any(char.IsControl)
            || trimmed.Count(c => c is '?' or '!') > 1 || trimmed.TrimEnd('?', '!', '.').Any(c => c is '?' or '!' or '.'))
            return (unknown, false, russian);

        var text = Normalize(trimmed);
        if (aliases.TryGetValue(text, out var exact))
            return (Answer(exact.Entry, russian), true, russian);

        var simplified = LeadIn.Replace(text, "");
        if (simplified != text && aliases.TryGetValue(simplified, out var direct))
            return (Answer(direct.Entry, russian), false, russian);

        // Every query term must be explained by the alias. A tie between topics is ambiguous.
        var terms = Terms(simplified);
        if (terms.Count < 3 || Words.Matches(simplified).Count != terms.Count)
            return (unknown, false, russian);
        var bestScore = 0.0;
        Entry? best = null;
        var ambiguous = false;
        foreach (var alias in aliases.Values)
        {
            if (!terms.IsSubsetOf(alias.Terms)) continue;
            var score = 2.0 * terms.Count / (terms.Count + alias.Terms.Count);
            if (score < MinimumScore) continue;
            if (score > bestScore)
            {
                best = alias.Entry;
                bestScore = score;
                ambiguous = false;
            }
            else if (alias.Entry != best)
            {
                ambiguous = true;
            }
        }
        return best != null && !ambiguous ? (Answer(best, russian), false, russian) : (unknown, false, russian);
    }

    private static readonly Regex StartingCost = new(
        @"\b(?:how much (?:do i need )?to start|minimum (?:investment|amount)|сколько (?:нужно )?начать|минимальн\w* сумм\w*)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Entry SharePriceGuide = new("starting-cost", "properties",
        "В карточке объекта указаны цена доли и доступное число долей. Цена доли рассчитывается делением цены объекта на число долей. Какой объект вы рассматриваете?",
        "Property details show the price per share and the number of available shares. The price per share is the property price divided by the total number of shares. Which property are you considering?",
        ["WebApp/README.md", "WebApp/src/pages.tsx"]);

    internal AssistantAnswer LocalAnswer(string question, string? previous, bool russian)
    {
        if (StartingCost.IsMatch(question)) return Answer(SharePriceGuide, russian);
        var result = Match(question, russian).Answer;
        if (result.Status == "unknown" && Keywords(question).Count == 0 && previous != null)
            return Match(previous, russian).Answer;
        return result;
    }

    internal IReadOnlyList<AssistantAnswer> Retrieve(string question, string? previous)
    {
        var terms = Keywords(question);
        if (terms.Contains("start") || terms.Contains("minimum") || terms.Contains("начать"))
            terms.UnionWith(["share", "price", "invest"]);
        var context = Keywords(previous ?? "");
        var eligible = aliases.Values.Where(alias => publicTopics.Contains(alias.Entry.Topic));
        var scores = eligible.GroupBy(alias => alias.Entry).Select(group => new
        {
            Entry = group.Key,
            Score = group.Max(alias => 4 * terms.Count(alias.Terms.Contains) + context.Count(alias.Terms.Contains))
                + (terms.Contains("price") && group.Key.Topic == "plan-share-price" ? 5 : 0)
        });
        var results = scores.Where(item => item.Score >= 4 || (terms.Count <= 2 && item.Score > 0)).OrderByDescending(item => item.Score)
            .ThenBy(item => item.Entry.Topic, StringComparer.Ordinal).Take(4)
            .Select(item => Answer(item.Entry, false));
        if (StartingCost.IsMatch(question))
            results = results.Prepend(Answer(SharePriceGuide, false));
        var overview = eligible.First(alias => alias.Entry.Topic == "app-overview").Entry;
        return results.DefaultIfEmpty(Answer(overview, false)).Take(4).ToArray();
    }

    private static readonly HashSet<string> commonTerms = Terms(
        "i me you my your is it a the and what which how can does do this that about of for in to on tell please ownersclub " +
        "как а и в о на мне что это про где сколько ли");

    private static HashSet<string> Keywords(string value) => Terms(Normalize(value))
        .Where(term => term.Length >= 2 && !commonTerms.Contains(term)).ToHashSet(StringComparer.Ordinal);

    // Product descriptions approved for the external provider. The full catalog remains available locally.
    private static readonly HashSet<string> publicTopics = Terms(
        "app-overview register email-confirmation profile properties property-images property-presentation property-video " +
        "property-stats investments application-history stage-status round-acceptance payment-plan plan-share-price " +
        "marketplace market-buy market-bids market-trades market-cancel market-extend market-fee wallet own-investments " +
        "own-applications own-payments wallet-add payment-currency payment-history withdraw-history rent-income rent-payout " +
        "rent-property-history club referral demo support-chat inbox notifications");

    private static AssistantAnswer Answer(Entry entry, bool russian) =>
        new AssistantAnswer("answered", Version, entry.Topic, russian ? entry.Russian : entry.English, entry.Sources)
        {
            SourceSections = [entry.Topic is "app-overview" or "register" or "support-chat" ? entry.Topic : entry.Group]
        };

    private static string SourcePath(string link)
    {
        var match = Regex.Match(link, @"^\[[^\]]+\]\(\.\./\.\./\.\./(?<path>(?:[\w.-]+/)*[\w.-]+)\)$");
        var path = match.Groups["path"].Value;
        if (!match.Success || path.Split('/').Any(segment => segment is "." or ".."))
            throw new InvalidOperationException("Assistant FAQ source must be a repository-relative Markdown link.");
        return path;
    }

    private static string Normalize(string text) =>
        string.Join(' ', Words.Matches(text.ToLowerInvariant().Replace('ё', 'е')).Select(match => match.Value));

    private static HashSet<string> Terms(string text) => text.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet(StringComparer.Ordinal);
}
