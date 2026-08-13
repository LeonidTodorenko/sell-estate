using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Dtos;

public sealed class AdminDemoAccountDto
{
    public Guid Id { get; init; }
    public string DemoCode { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public decimal WalletBalance { get; init; }
    public bool IsTemplate { get; init; }
    public bool IsActive { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? LastActiveAt { get; init; }
    public DateTime? ExpiresAt { get; init; }
}

public sealed class AdminCreateDemoAccountRequest
{
    [Required, MaxLength(200)]
    public string FullName { get; init; } = string.Empty;

    [Required, EmailAddress, MaxLength(320)]
    public string Email { get; init; } = string.Empty;

    [Required, MinLength(8)]
    public string Password { get; init; } = string.Empty;

    [MaxLength(64)]
    public string? DemoCode { get; init; }

    public DateTime? ExpiresAt { get; init; }
}

public sealed class AdminSetDemoAccountActiveRequest
{
    public bool IsActive { get; init; }
}
