using RealEstateInvestment.Enums;

public static class EnumHelpers
{
    public static string[] FlagsToNames(PermissionFlags flags, bool includeNone = false)
    {
        if (flags == PermissionFlags.None)
            return includeNone ? new[] { nameof(PermissionFlags.None) } : Array.Empty<string>();

        return Enum.GetValues<PermissionFlags>()
            .Where(f => f != PermissionFlags.None && flags.HasFlag(f))
            .Select(f => f.ToString())
            .ToArray();
    }
}
