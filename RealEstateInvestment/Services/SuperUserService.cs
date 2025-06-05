using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Services
{
    public class SuperUserService : ISuperUserService
    {
        private readonly IConfiguration _config;
        private readonly AppDbContext _context;

        public SuperUserService(IConfiguration config, AppDbContext context)
        {
            _config = config;
            _context = context;
        }

        public Guid GetSuperUserId()
        {
            return Guid.Parse(_config["SuperUser:Id"]);
        }

        public async Task EnsureSuperUserExistsAsync()
        {
            var id = GetSuperUserId();
            var existing = await _context.Users.FindAsync(id);
            if (existing != null) return;

            var user = new User
            {
                Id = id,
                FullName = "Super Admin",
                Email = "admin@admintest.com",
                PasswordHash = "Admin123!", 
                SecretWord = "admin-secret",  
                Role = "admin",
                IsEmailConfirmed = true,
                KycStatus = "verified",
                CreatedAt = DateTime.UtcNow,
                WalletBalance = 10000000000
            };

            _context.Users.Add(user);
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = id,
                Action = "System",
                Details = "SuperUser created automatically"
            });

            await _context.SaveChangesAsync();
        }
    }

    public interface ISuperUserService
    {
        Guid GetSuperUserId();
        Task EnsureSuperUserExistsAsync();
    }

}
