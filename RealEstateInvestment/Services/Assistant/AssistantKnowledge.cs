using System.Text.RegularExpressions;

namespace RealEstateInvestment.Services.Assistant;

public sealed record AssistantAnswer(string Status, string Version, string? Topic, string Answer, IReadOnlyList<string> Sources)
{
    public string Language { get; init; } = "en";
}

public sealed class AssistantKnowledge
{
    private sealed record Entry(string Topic, string Russian, string English, string[] Sources);
    private sealed record Alias(Entry Entry, HashSet<string> Terms);

    public const string Version = "30.7.3";
    private const double MinimumScore = 0.80;
    private readonly Dictionary<string, Alias> aliases = new(StringComparer.Ordinal);
    private static readonly Regex Allowed = new(@"^[a-zа-яё0-9 .?!,\-]+$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex Words = new(@"[a-zа-я0-9]+", RegexOptions.CultureInvariant);
    private static readonly Regex LeadIn = new(
        @"^(?:please (?:explain|show me|tell me about)|(?:what is|what are|where is|how does|how do i|how can i)|(?:что такое|расскажите про|как работает|где посмотреть)) ",
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

            var entry = new Entry(lines[0], lines[4], lines[5], lines[6][9..].Split(" | ").Select(SourcePath).ToArray());
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
            : "The FAQ has no verified answer. Try one general question about OwnersClub features.", Array.Empty<string>());
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

    private static AssistantAnswer Answer(Entry entry, bool russian) =>
        new("answered", Version, entry.Topic, russian ? entry.Russian : entry.English, entry.Sources);

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
