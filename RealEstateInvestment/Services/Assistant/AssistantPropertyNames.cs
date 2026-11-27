using System.Text.RegularExpressions;

namespace RealEstateInvestment.Services.Assistant;

internal static class AssistantPropertyNames
{
    private static string Normalize(string value) => Regex.Replace(value.Trim(), @"\s+", " ");

    internal static bool Equal(string? title, string input) =>
        title is not null && string.Equals(Normalize(title), Normalize(input), StringComparison.OrdinalIgnoreCase);

    internal static T[] Match<T>(string input, IEnumerable<T> properties, Func<T, string?> title)
    {
        var normalized = Normalize(input);
        var matches = properties.SelectMany(property =>
        {
            var name = Normalize(title(property) ?? "");
            return name.Length == 0 ? [] : Regex.Matches(normalized,
                $@"(?<![\p{{L}}\p{{N}}]){Regex.Escape(name)}(?![\p{{L}}\p{{N}}])",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)
                .Select(match => (Property: property, match.Index, match.Length));
        }).ToArray();
        return matches.Where(hit => !matches.Any(other => other.Length > hit.Length && other.Index <= hit.Index &&
            other.Index + other.Length >= hit.Index + hit.Length)).Select(hit => hit.Property).Distinct().ToArray();
    }
}
