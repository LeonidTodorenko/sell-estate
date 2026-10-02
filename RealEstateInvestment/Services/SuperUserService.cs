using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Services
{
    public class SuperUserService : ISuperUserService
    {
        private readonly IConfiguration _config;
        private readonly AppDbContext _context;
        private readonly IHostEnvironment _environment;

        public SuperUserService(IConfiguration config, AppDbContext context, IHostEnvironment environment)
        {
            _config = config;
            _context = context;
            _environment = environment;
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

            if (_environment.IsProduction())
            {
                throw new InvalidOperationException(
                    $"Configured production SuperUser {id} does not exist. Automatic production admin creation is disabled.");
            }

            var email = RequireBootstrapSetting("SuperUser:Bootstrap:Email");
            var password = RequireBootstrapSetting("SuperUser:Bootstrap:Password");
            var secretWord = RequireBootstrapSetting("SuperUser:Bootstrap:SecretWord");

            var user = new User
            {
                Id = id,
                FullName = _config["SuperUser:Bootstrap:FullName"]?.Trim() ?? "Development Super Admin",
                Email = email,
                PasswordHash = password,
                SecretWord = secretWord,
                Role = "admin",
                IsEmailConfirmed = true,
                KycStatus = "verified",
                CreatedAt = DateTime.UtcNow,
                WalletBalance = 0
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

        private string RequireBootstrapSetting(string key)
        {
            var value = _config[key]?.Trim();
            if (!string.IsNullOrWhiteSpace(value)) return value;

            throw new InvalidOperationException(
                $"Development SuperUser bootstrap requires configuration setting {key}.");
        }
    }

    public interface ISuperUserService
    {
        Guid GetSuperUserId();
        Task EnsureSuperUserExistsAsync();
    }

}
