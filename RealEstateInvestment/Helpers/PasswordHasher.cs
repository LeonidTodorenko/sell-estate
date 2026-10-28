using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace RealEstateInvestment.Helpers;

public static class PasswordHasher
{
    private const string Prefix = "$oc$";
    private const string DemoShaPrefix = "$oc-sha256$";
    private static readonly PasswordHasher<object> Hasher = new(Options.Create(
        new PasswordHasherOptions { IterationCount = 210_000 }));
    private static readonly object Subject = new();
    public static string HashPassword(string password) => Prefix + Hasher.HashPassword(Subject, password);
    public static bool NeedsRehash(string stored) => !stored.StartsWith(Prefix, StringComparison.Ordinal) && !stored.StartsWith(DemoShaPrefix, StringComparison.Ordinal);
    public static bool VerifyPassword(string password, string stored)
    {
        if (password == null || stored == null) return false;
        if (stored.StartsWith(Prefix, StringComparison.Ordinal))
        {
            try { return Hasher.VerifyHashedPassword(Subject, stored[Prefix.Length..], password) != PasswordVerificationResult.Failed; }
            catch (FormatException) { return false; }
        }
        // Transitional normal-account plaintext support. Successful login upgrades it.
        return Equal(password, stored);
    }
    // Legacy demo factory used SHA-256; wrap that digest in salted PBKDF2 during
    // the explicit migration, then replace with direct PBKDF2 at the next login.
    public static bool IsLegacyDemoSha(string stored)
    {
        if (stored.Length != 44) return false;
        try { return Convert.FromBase64String(stored).Length == 32; }
        catch (FormatException) { return false; }
    }
    public static string WrapLegacyDemoSha(string digest) => DemoShaPrefix + Hasher.HashPassword(Subject, digest);
    public static bool VerifyDemoPassword(string password, string stored)
    {
        var digest = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(password)));
        if (stored.StartsWith(DemoShaPrefix, StringComparison.Ordinal))
        {
            try { return Hasher.VerifyHashedPassword(Subject, stored[DemoShaPrefix.Length..], digest) != PasswordVerificationResult.Failed; }
            catch (FormatException) { return false; }
        }
        return IsLegacyDemoSha(stored) ? Equal(digest, stored) : VerifyPassword(password, stored);
    }
    public static bool DemoNeedsRehash(string stored) => !stored.StartsWith(Prefix, StringComparison.Ordinal);
    private static bool Equal(string left, string right) => CryptographicOperations.FixedTimeEquals(
        SHA256.HashData(Encoding.UTF8.GetBytes(left)), SHA256.HashData(Encoding.UTF8.GetBytes(right)));
}
