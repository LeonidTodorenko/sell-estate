using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace RealEstateInvestment.Services.Assistant;

public sealed class GeminiFaqAdapter(HttpClient http, string? apiKey, TimeProvider clock, TimeSpan? timeout = null) : IDisposable
{
    private sealed record PublicExample(string Question, string BriefEnglish, string BriefRussian);

    // Only these vetted, general product definitions can cross the network boundary.
    private static readonly IReadOnlyDictionary<string, PublicExample> PublicExamples =
        new Dictionary<string, PublicExample>(StringComparer.Ordinal)
        {
            ["properties"] = new("How is property information displayed?",
                "Android has a property details screen, and related media loads separately.",
                "В Android есть карточка объекта, а связанные медиа загружаются отдельно."),
            ["property-images"] = new("How are property photos grouped?",
                "Photos are listed separately for each property.",
                "У каждого объекта свой список фотографий."),
            ["payment-plan"] = new("What does a property payment plan contain?",
                "A property's plan records an event date, deadline, and amount for each entry.",
                "В каждой записи графика объекта указаны дата события, срок и сумма.")
        };

    private readonly SemaphoreSlim slot = new(1);
    private DateTimeOffset retryAt;
    private bool unavailable;
    private DateTimeOffset nextRequest;
    private DateOnly budgetDate;
    private int requestsToday;
    private static readonly TimeZoneInfo QuotaTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Pacific Standard Time");
    private const string Endpoint =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

    public void Dispose() => http.Dispose();

    internal async Task<AssistantAnswer> PresentAsync(AssistantAnswer local, bool russian, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(apiKey) || local.Topic is null
            || !PublicExamples.TryGetValue(local.Topic, out var example) || !slot.Wait(0, ct))
            return local;

        try
        {
            var now = clock.GetUtcNow();
            if (unavailable || now < retryAt || now < nextRequest) return local;
            var date = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, QuotaTimeZone).DateTime);
            if (date != budgetDate)
            {
                budgetDate = date;
                requestsToday = 0;
            }
            if (requestsToday >= 100) return local;
            requestsToday++;
            nextRequest = now.AddSeconds(12);

            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct);
            deadline.CancelAfter(timeout ?? TimeSpan.FromSeconds(12));
            var brief = russian ? example.BriefRussian : example.BriefEnglish;
            var prompt = $"Decide whether this verified excerpt fully answers the general OwnersClub question. " +
                $"Reply BRIEF if the excerpt is sufficient, or FULL if the detailed FAQ is needed.\n" +
                $"Question: {example.Question}\nExcerpt: {brief}";
            using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint)
            {
                Content = JsonContent.Create(new
                {
                    contents = new[] { new { parts = new[] { new { text = prompt } } } },
                    generationConfig = new { temperature = 0, maxOutputTokens = 32, thinkingConfig = new { thinkingLevel = "minimal" } }
                })
            };
            request.Headers.Add("x-goog-api-key", apiKey);
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
            if (!response.IsSuccessStatusCode)
            {
                if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized
                    or HttpStatusCode.Forbidden or HttpStatusCode.NotFound)
                    unavailable = true;

                now = clock.GetUtcNow();
                retryAt = now.AddMinutes(1);
                var retryAfter = response.Headers.RetryAfter;
                if (retryAfter?.Date > retryAt) retryAt = retryAfter.Date.Value;
                if (retryAfter?.Delta is { } delay && delay.TotalSeconds > 60)
                    retryAt = now.Add(delay > TimeSpan.FromDays(1) ? TimeSpan.FromDays(1) : delay);
                return local;
            }

            const int maxResponseBytes = 8192;
            using var stream = await response.Content.ReadAsStreamAsync(deadline.Token);
            var bytes = new byte[maxResponseBytes + 1];
            var count = await stream.ReadAtLeastAsync(bytes, bytes.Length, false, deadline.Token);
            if (count > maxResponseBytes) return local;
            using var json = JsonDocument.Parse(bytes.AsMemory(0, count));
            var candidate = json.RootElement.GetProperty("candidates")[0];
            var parts = candidate.GetProperty("content").GetProperty("parts");
            if (candidate.GetProperty("finishReason").GetString() == "STOP" && parts.GetArrayLength() == 1
                && parts[0].GetProperty("text").GetString()?.Trim() == "BRIEF")
                return local with { Answer = brief };
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            retryAt = clock.GetUtcNow().AddMinutes(1);
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException or JsonException
            or InvalidOperationException or KeyNotFoundException or IndexOutOfRangeException or FormatException)
        {
            retryAt = clock.GetUtcNow().AddMinutes(1);
        }
        finally
        {
            slot.Release();
        }

        return local;
    }
}
