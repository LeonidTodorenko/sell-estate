namespace RealEstateInvestment.Helpers;

public static class ProductionStartupGuard
{
    private static readonly string[] RequiredSettings =
    {
        "ConnectionStrings:DefaultConnection",
        "Jwt:Key",
        "Jwt:Issuer",
        "Jwt:Audience",
        "Resend:ApiKey",
        "SuperUser:Id",
        "App:UploadsRoot",
        "Firebase:CredentialsPath"
    };

    public static void Validate(IConfiguration configuration, IHostEnvironment environment)
    {
        if (!environment.IsProduction()) return;

        var missing = RequiredSettings
            .Where(key => string.IsNullOrWhiteSpace(configuration[key]))
            .ToArray();

        if (missing.Length > 0)
        {
            throw new InvalidOperationException(
                $"Production configuration is missing required settings: {string.Join(", ", missing)}.");
        }

        if (!Guid.TryParse(configuration["SuperUser:Id"], out _))
            throw new InvalidOperationException("Production configuration setting SuperUser:Id must be a valid GUID.");
    }
}
