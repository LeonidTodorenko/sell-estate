namespace RealEstateInvestment.Services.Demo;

public static class DemoTemplateDefaults
{
    public const string TemplateCode = "DEMO-TEMPLATE";
    public const string TemplateEmail = "demo-template@ownersclub.local";
    public const string TemplateFullName = "Demo Investor Template";
    public const string TemplateClientNumber = "DEMO-TPL-001";
    public const string TemplateSecretWord = "sandbox";
    public const string TemplatePassword = "DemoTemplateOnly!";
    public const string TermsVersion = "demo-v1";
    public const decimal StartingWalletBalance = 45_000m;
    public const int PropertyCount = 3;
    public static readonly int[] InvestmentShares = [10, 8, 6];
    public static readonly decimal[] RentalMultipliers = [0.8m, 0.9m, 1m];
    public const int OfferShares = 2;
    public const decimal OfferMarkup = 1.05m;
    public const decimal BuyoutMarkup = 1.12m;
    public const decimal BidMarkup = 1.03m;
}
