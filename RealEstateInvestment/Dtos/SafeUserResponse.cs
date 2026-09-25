using System.Linq.Expressions;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Dtos;

// Explicit allowlist: never serialize account entities or their credentials.
public sealed class SafeUserResponse
{
    public Guid Id { get; init; }
    public string FullName { get; init; } = "";
    public string Email { get; init; } = "";
    public string Role { get; init; } = "";
    public UserRole UserRole { get; init; }
    public PermissionFlags Permissions { get; init; }
    public string KycStatus { get; init; } = "";
    public bool IsBlocked { get; init; }
    public DateTime CreatedAt { get; init; }
    public decimal WalletBalance { get; init; }
    public string? PhoneNumber { get; init; }
    public string? Address { get; init; }
    public string? AvatarBase64 { get; init; }
    public bool IsEmailConfirmed { get; init; }
    public string ClientNumber { get; init; } = "";
    public DateTime? TermsAcceptedAt { get; init; }
    public string? TermsVersion { get; init; }
    public DateTime? KycContractSentAt { get; init; }
    public string? KycContractVersion { get; init; }
    public bool HasPin { get; init; }
    public bool? IsDeleted { get; init; }
    public DateTime? DeletedAt { get; init; }

    public static readonly Expression<Func<User, SafeUserResponse>> Production = u => new SafeUserResponse
    {
        Id = u.Id, FullName = u.FullName, Email = u.Email, Role = u.Role,
        UserRole = u.UserRole, Permissions = u.Permissions, KycStatus = u.KycStatus,
        IsBlocked = u.IsBlocked, CreatedAt = u.CreatedAt, WalletBalance = u.WalletBalance,
        PhoneNumber = u.PhoneNumber, Address = u.Address, AvatarBase64 = u.AvatarBase64,
        IsEmailConfirmed = u.IsEmailConfirmed, ClientNumber = u.ClientNumber,
        TermsAcceptedAt = u.TermsAcceptedAt, TermsVersion = u.TermsVersion,
        KycContractSentAt = u.KycContractSentAt, KycContractVersion = u.KycContractVersion,
        HasPin = u.PinCode != null && u.PinCode != "", IsDeleted = u.IsDeleted, DeletedAt = u.DeletedAt
    };

    public static readonly Expression<Func<DemoUser, SafeUserResponse>> Demo = u => new SafeUserResponse
    {
        Id = u.Id, FullName = u.FullName, Email = u.Email, Role = u.Role,
        UserRole = u.UserRole, Permissions = u.Permissions, KycStatus = u.KycStatus,
        IsBlocked = u.IsBlocked, CreatedAt = u.CreatedAt, WalletBalance = u.WalletBalance,
        PhoneNumber = u.PhoneNumber, Address = u.Address, AvatarBase64 = u.AvatarBase64,
        IsEmailConfirmed = u.IsEmailConfirmed, ClientNumber = u.ClientNumber,
        TermsAcceptedAt = u.TermsAcceptedAt, TermsVersion = u.TermsVersion,
        KycContractSentAt = u.KycContractSentAt, KycContractVersion = u.KycContractVersion,
        HasPin = u.PinCode != null && u.PinCode != "", IsDeleted = u.IsDeleted, DeletedAt = u.DeletedAt
    };
}
