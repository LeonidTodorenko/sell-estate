using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Property> Properties { get; set; }
        public DbSet<Investment> Investments { get; set; }
        public DbSet<RentalIncome> RentalIncomes { get; set; }
        public DbSet<WithdrawalRequest> WithdrawalRequests { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<KycDocument> KycDocuments { get; set; }
        public DbSet<ActionLog> ActionLogs { get; set; }
        public DbSet<EmailConfirmationToken> EmailConfirmationTokens { get; set; }
        public DbSet<PropertyImage> PropertyImages { get; set; }
        public DbSet<PaymentPlan> PaymentPlans { get; set; }
        public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<InvestmentApplication> InvestmentApplications { get; set; }
        public DbSet<ShareOffer> ShareOffers { get; set; }
        public DbSet<ShareOfferBid> ShareOfferBids { get; set; }
        public DbSet<SystemSetting> SystemSettings { get; set; }
        public DbSet<ShareTransaction> ShareTransactions { get; set; }
        public DbSet<UserTransaction> UserTransactions { get; set; }
        public DbSet<ChatMessage> ChatMessages { get; set; }
        public DbSet<FcmDeviceToken> FcmDeviceTokens { get; set; }
        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
        public DbSet<ReferralInvite> ReferralInvites { get; set; }
        public DbSet<Referral> Referrals { get; set; }
        public DbSet<ModerationRequest> ModerationRequests { get; set; }
        public DbSet<PropertyMedia> PropertyMedias { get; set; }


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {

            base.OnModelCreating(modelBuilder);

            // use UtcDateTimeConverter to all DateTime
            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                var properties = entityType.ClrType.GetProperties()
                    .Where(p => p.PropertyType == typeof(DateTime) || p.PropertyType == typeof(DateTime?));

                foreach (var property in properties)
                {
                    modelBuilder.Entity(entityType.Name).Property(property.Name)
                        .HasConversion(new UtcDateTimeConverter());
                }
            }

            modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
            
            modelBuilder.Entity<User>()
                        .HasIndex(u => u.ClientNumber)
                        .IsUnique();

            modelBuilder.Entity<User>()
                         .HasIndex(u => u.PhoneNumber)
                         .IsUnique()
                         .HasFilter("\"PhoneNumber\" IS NOT NULL AND \"PhoneNumber\" <> ''");

            modelBuilder.Entity<RefreshToken>()
                        .HasIndex(x => x.UserId);

            modelBuilder.Entity<RefreshToken>()
                        .Property(x => x.TokenHash)
                        .IsRequired();

            modelBuilder.Entity<ReferralInvite>(b =>
            {
                b.HasKey(x => x.Id);
                b.HasIndex(x => x.InviterUserId);
                b.HasIndex(x => x.InviteeEmail);
                b.HasIndex(x => x.CodeHash).IsUnique(false);
            });

            modelBuilder.Entity<Referral>(b =>
            {
                b.HasKey(x => x.Id);
                b.HasIndex(x => x.InviterUserId);
                b.HasIndex(x => x.InviteId);
                b.HasIndex(x => x.RefereeUserId).IsUnique();
            });

            modelBuilder.Entity<ModerationRequest>(b =>
            {
                b.HasKey(x => x.Id);
                b.HasIndex(x => new { x.Target, x.TargetId, x.Field, x.Status });
                b.HasIndex(x => x.Fingerprint);
            });
        }

    }
}
