 
namespace RealEstateInvestment.Dtos
{
    public class AdminUserListItemDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public int UserRole { get; set; }
        public string UserRoleText { get; set; } = "";
        public long Permissions { get; set; }                
        public string[] PermissionsText { get; set; } = [];    

        public bool IsBlocked { get; set; }
        public bool IsEmailConfirmed { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
