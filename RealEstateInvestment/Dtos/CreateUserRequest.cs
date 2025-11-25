using RealEstateInvestment.Enums;

namespace RealEstateInvestment.Dtos
{
    public class CreateUserRequest
    {
        public string FullName { get; set; } = default!;
        public string Email { get; set; } = default!;
        public string Password { get; set; } = default!;
        public UserRole Role { get; set; } = UserRole.Investor;
        public PermissionFlags? Permissions { get; set; } // игнорится если не SuperAdmin
    }
}
