namespace RealEstateInvestment.Services.Assistant;

// The provider receives an application-authored synthetic fixture only.
public enum AssistantExample { PublicFaq }
public sealed record AssistantProviderResult(bool Available);

public interface IAssistantProvider
{
    Task<AssistantProviderResult> CheckExampleAsync(AssistantExample example, CancellationToken cancellationToken);
}

public sealed class MockAssistantProvider : IAssistantProvider
{
    public Task<AssistantProviderResult> CheckExampleAsync(AssistantExample example, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(new AssistantProviderResult(example == AssistantExample.PublicFaq));
    }
}

public sealed class AssistantProviderProbe(IAssistantProvider provider)
{
    private readonly SemaphoreSlim slot = new(1);

    public async Task<bool> CheckAsync(CancellationToken cancellationToken)
    {
        if (!slot.Wait(0, cancellationToken)) return false;
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromMilliseconds(300));

        // Keep the slot until the provider really exits, even if it ignores cancellation.
        var token = deadline.Token;
        var operation = Task.Run(() => RunAsync(token), CancellationToken.None);
        try { return (await operation.WaitAsync(deadline.Token)).Available; }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested) { return false; }
    }

    private async Task<AssistantProviderResult> RunAsync(CancellationToken cancellationToken)
    {
        try { return await provider.CheckExampleAsync(AssistantExample.PublicFaq, cancellationToken); }
        catch (Exception) { return new(false); }
        finally { slot.Release(); }
    }
}
