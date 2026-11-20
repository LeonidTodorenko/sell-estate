using System.Net;
using System.Text.RegularExpressions;

namespace RealEstateInvestment.Services.Assistant;

public sealed record AssistantSource(string Title, string? Url = null);

internal static class AssistantPresentation
{
    private static readonly Regex Citations = new(@"\[\s*\d+(?:\s*[,–-]\s*\d+)*\s*\]", RegexOptions.CultureInvariant);
    private static readonly Regex TechnicalText = new(
        @"(?ix)
        \b(?:sources|references|citations|источники|ссылки\ на\ источники)\b[\s*_~]*[:：]
        | ^[\s>*\#_-]*(?:sources|references|citations|источники|ссылки\ на\ источники)[\s*_~]*$
        | \b[a-z][a-z0-9+.-]*\s*:\s*[/\\]{2}
        | \b(?:ownersclub|intent|file|javascript|data|mailto):
        | (?<!\w)[/\\](?=[\w.-])
        | [\w.-]+[/\\][\w.-]+
        | \b[\w.-]+\.(?:cs|csproj|sln|md|txt|tsx?|jsx?|json|kt|java|ya?ml|sql|py|ps1|sh|xml|gradle|html?|css|env|log|dll|config|properties|toml)\b
        | \b(?:Dockerfile|Makefile)\b
        | \b[\w.]*(?:Controller|Endpoint|Middleware|Adapter)\b(?<!\bController)(?<!\bEndpoint)(?<!\bMiddleware)(?<!\bAdapter)",
        RegexOptions.Multiline | RegexOptions.CultureInvariant);

    internal static string? CleanText(string answer)
    {
        var normalized = WebUtility.HtmlDecode(Uri.UnescapeDataString(answer)).Normalize();
        normalized = Regex.Replace(normalized, @"\p{Cf}", "");
        var clean = Citations.Replace(normalized, "");
        clean = Regex.Replace(clean, @"[ \t]+(?=\r?$|[.,!?])", "", RegexOptions.Multiline).Trim();
        return clean.Length == 0 || TechnicalText.IsMatch(clean) ? null : clean;
    }

    internal static AssistantAnswer ForClient(AssistantAnswer answer, bool russian)
    {
        var sources = answer.SourceSections.Distinct().Select(section => Describe(section, russian)).Distinct().ToArray();
        return answer with
        {
            Answer = CleanText(answer.Answer) ?? (russian
                ? "Уточните, что вы хотите узнать о работе OwnersClub."
                : "What would you like to know about using OwnersClub?"),
            Sources = sources.Select(source => source.Title).ToArray(),
            SourceLinks = sources
        };
    }

    private static AssistantSource Describe(string section, bool russian)
    {
        var (en, ru, url) = section switch
        {
            "app-overview" => ("About OwnersClub", "Об OwnersClub", "https://wamsoc.com/about"),
            "register" => ("OwnersClub registration", "Регистрация в OwnersClub", "https://wamsoc.com/register"),
            "support-chat" => ("OwnersClub support", "Поддержка OwnersClub", "https://wamsoc.com/support"),
            "account" or "identity" => ("Account help", "Справка по аккаунту", null),
            "admin" => ("Administration guide", "Справка по администрированию", null),
            "club" => ("OwnersClub community guide", "Справка о клубе OwnersClub", null),
            "demo" => ("Demo account guide", "Справка о демосчёте", null),
            "investment" or "stages" or "scheduler" => ("Investment guide", "Справка по инвестициям", null),
            "marketplace" => ("Marketplace guide", "Справка по маркетплейсу", null),
            "payments" or "evidence" or "wallet" => ("Payments and wallet guide", "Справка по платежам и кошельку", null),
            "properties" => ("Property catalog guide", "Справка по каталогу объектов", null),
            "referral" => ("Referral program guide", "Справка по реферальной программе", null),
            "rent" => ("Rental income guide", "Справка по арендному доходу", null),
            "security" => ("Security guide", "Справка по безопасности", null),
            "support" => ("Messages and notifications guide", "Справка по сообщениям и уведомлениям", null),
            "withdrawals" => ("Withdrawals guide", "Справка по выводу средств", null),
            _ => ("OwnersClub help", "Справка OwnersClub", null)
        };
        return new(russian ? ru : en, url);
    }
}
