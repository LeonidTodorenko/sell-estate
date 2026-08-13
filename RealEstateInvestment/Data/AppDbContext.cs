using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(
            DbContextOptions<AppDbContext> options
        ) : base(options)
        {
        }

        // =========================================================
        // PRODUCTION TABLES
        // =========================================================

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

        // =========================================================
        // DEMO / SANDBOX TABLES
        // =========================================================

        public DbSet<DemoUser> DemoUsers { get; set; }

        public DbSet<DemoInvestment> DemoInvestments { get; set; }

        public DbSet<DemoInvestmentApplication> DemoInvestmentApplications { get; set; }

        public DbSet<DemoRentalIncome> DemoRentalIncomes { get; set; }

        public DbSet<DemoUserTransaction> DemoUserTransactions { get; set; }

        public DbSet<DemoKycDocument> DemoKycDocuments { get; set; }

        public DbSet<DemoMessage> DemoMessages { get; set; }

        public DbSet<DemoShareOffer> DemoShareOffers { get; set; }

        public DbSet<DemoShareOfferBid> DemoShareOfferBids { get; set; }

        public DbSet<DemoShareTransaction> DemoShareTransactions { get; set; }

        public DbSet<DemoActionLog> DemoActionLogs { get; set; }

        public DbSet<DemoMonthlyReport> DemoMonthlyReports { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // =====================================================
            // UTC conversion for all DateTime / DateTime?
            // =====================================================

            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                var properties = entityType.ClrType
                    .GetProperties()
                    .Where(p =>
                        p.PropertyType == typeof(DateTime) ||
                        p.PropertyType == typeof(DateTime?));

                foreach (var property in properties)
                {
                    modelBuilder
                        .Entity(entityType.Name)
                        .Property(property.Name)
                        .HasConversion(new UtcDateTimeConverter());
                }
            }

            // =====================================================
            // PRODUCTION CONFIGURATION
            // =====================================================

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            modelBuilder.Entity<User>()
                .HasIndex(u => u.ClientNumber)
                .IsUnique();

            modelBuilder.Entity<User>()
                .HasIndex(u => u.PhoneNumber)
                .IsUnique()
                .HasFilter(
                    "\"PhoneNumber\" IS NOT NULL AND \"PhoneNumber\" <> ''");

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

                b.HasIndex(x => x.CodeHash)
                    .IsUnique(false);
            });

            modelBuilder.Entity<Referral>(b =>
            {
                b.HasKey(x => x.Id);

                b.HasIndex(x => x.InviterUserId);

                b.HasIndex(x => x.InviteId);

                b.HasIndex(x => x.RefereeUserId)
                    .IsUnique();
            });

            modelBuilder.Entity<ModerationRequest>(b =>
            {
                b.HasKey(x => x.Id);

                b.HasIndex(x => new
                {
                    x.Target,
                    x.TargetId,
                    x.Field,
                    x.Status
                });

                b.HasIndex(x => x.Fingerprint);
            });

            // =====================================================
            // DEMO USER
            // =====================================================

            modelBuilder.Entity<DemoUser>(b =>
            {
                b.HasKey(x => x.Id);

                b.HasIndex(x => x.DemoCode)
                    .IsUnique();

                b.HasIndex(x => x.Email)
                    .IsUnique();

                b.HasIndex(x => x.ClientNumber)
                    .IsUnique();

                b.HasIndex(x => x.IsTemplate)
                    .IsUnique()
                    .HasFilter("\"IsTemplate\" = true");

                b.HasIndex(x => x.IsActive);

                b.HasIndex(x => x.ExpiresAt);
            });

            // =====================================================
            // DEMO INVESTMENTS
            // =====================================================

            modelBuilder.Entity<DemoInvestment>(b =>
            {
                b.HasKey(x => x.Id);

                b.HasIndex(x => x.DemoUserId);

                b.HasIndex(x => x.PropertyId);

                b.HasIndex(x => new
                {
                    x.DemoUserId,
                    x.PropertyId
                });

                b.HasOne(x => x.DemoUser)
                    .WithMany()
                    .HasForeignKey(x => x.DemoUserId)
                    .OnDelete(DeleteBehavior.Cascade);

                // Demo никогда не должен каскадно влиять на Property.
                b.HasOne(x => x.Property)
                    .WithMany()
                    .HasForeignKey(x => x.PropertyId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // =====================================================
            // DEMO INVESTMENT APPLICATIONS
            // =====================================================

            modelBuilder.Entity<DemoInvestmentApplication>(b =>
            {
                b.HasKey(x => x.Id);

                b.HasIndex(x => x.DemoUserId);

                b.HasIndex(x => x.PropertyId);

                b.HasIndex(x => new
                {
                    x.DemoUserId,
                    x.Status
                });

                b.HasOne(x => x.DemoUser)
                    .WithMany()
                    .HasForeignKey(x => x.DemoUserId)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(x => x.Property)
                    .WithMany()
                    .HasForeignKey(x => x.PropertyId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // =====================================================
            // DEMO RENTAL INCOME
            // =====================================================

            modelBuilder.Entity<DemoRentalIncome>(b =>
            {
                b.HasKey(x => x.Id);

                b.HasIndex(x => x.DemoInvestorId);

                b.HasIndex(x => x.PropertyId);

                b.HasIndex(x => x.PayoutDate);

                b.HasIndex(x => new
                    {
                        x.DemoInvestorId,
                        x.PropertyId,
                        x.PayoutMonth
                    })
                    .IsUnique();

                b.HasOne(x => x.DemoInvestor)
                    .WithMany()
                    .HasForeignKey(x => x.DemoInvestorId)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(x => x.Property)
                    .WithMany()
                    .HasForeignKey(x => x.PropertyId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // =====================================================
            // DEMO TRANSACTIONS
            // =====================================================

            modelBuilder.Entity<DemoUserTransaction>(b =>
            {
                b.HasKey(x => x.Id);

                b.HasIndex(x => x.DemoUserId);

                b.HasIndex(x => x.Timestamp);

                b.HasIndex(x => new
                {
                    x.DemoUserId,
                    x.Timestamp
                });

                b.HasOne(x => x.DemoUser)
                    .WithMany()
                    .HasForeignKey(x => x.DemoUserId)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(x => x.Property)
                    .WithMany()
                    .HasForeignKey(x => x.PropertyId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // =====================================================
            // DEMO KYC
            // =====================================================

            modelBuilder.Entity<DemoKycDocument>(b =>
            {
                b.HasKey(x => x.Id);

                b.HasIndex(x => x.DemoUserId);

                b.HasIndex(x => new
                {
                    x.DemoUserId,
                    x.Status
                });

                b.HasOne(x => x.DemoUser)
                    .WithMany()
                    .HasForeignKey(x => x.DemoUserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // =====================================================
            // DEMO MESSAGES
            // =====================================================

            modelBuilder.Entity<DemoMessage>(b =>
            {
                b.HasKey(x => x.Id);

                b.HasIndex(x => x.DemoRecipientId);

                b.HasIndex(x => x.CreatedAt);

                b.HasOne(x => x.DemoRecipient)
                    .WithMany()
                    .HasForeignKey(x => x.DemoRecipientId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // =====================================================
            // DEMO SHARE OFFERS
            // =====================================================

            modelBuilder.Entity<DemoShareOffer>(b =>
            {
                b.HasKey(x => x.Id);

                b.HasIndex(x => x.DemoSellerId);

                b.HasIndex(x => x.PropertyId);

                b.HasIndex(x => x.IsActive);

                b.HasIndex(x => x.ExpirationDate);

                b.HasOne(x => x.DemoSeller)
                    .WithMany()
                    .HasForeignKey(x => x.DemoSellerId)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(x => x.Property)
                    .WithMany()
                    .HasForeignKey(x => x.PropertyId)
                    .OnDelete(DeleteBehavior.Restrict);

                b.HasOne(x => x.DemoInvestment)
                    .WithMany()
                    .HasForeignKey(x => x.DemoInvestmentId)
                    .OnDelete(DeleteBehavior.SetNull);
            });

            // =====================================================
            // DEMO BIDS
            // =====================================================

            modelBuilder.Entity<DemoShareOfferBid>(b =>
            {
                b.HasKey(x => x.Id);

                b.HasIndex(x => x.DemoOfferId);

                b.HasIndex(x => x.DemoBidderId);

                b.HasOne(x => x.DemoOffer)
                    .WithMany(x => x.Bids)
                    .HasForeignKey(x => x.DemoOfferId)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(x => x.DemoBidder)
                    .WithMany()
                    .HasForeignKey(x => x.DemoBidderId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // =====================================================
            // DEMO SHARE TRANSACTIONS
            // =====================================================

            modelBuilder.Entity<DemoShareTransaction>(b =>
            {
                b.HasKey(x => x.Id);

                b.HasIndex(x => x.DemoBuyerId);

                b.HasIndex(x => x.DemoSellerId);

                b.HasIndex(x => x.PropertyId);

                b.HasIndex(x => x.Timestamp);

                b.HasOne(x => x.DemoBuyer)
                    .WithMany()
                    .HasForeignKey(x => x.DemoBuyerId)
                    .OnDelete(DeleteBehavior.Restrict);

                b.HasOne(x => x.DemoSeller)
                    .WithMany()
                    .HasForeignKey(x => x.DemoSellerId)
                    .OnDelete(DeleteBehavior.Restrict);

                b.HasOne(x => x.Property)
                    .WithMany()
                    .HasForeignKey(x => x.PropertyId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // =====================================================
            // DEMO ACTION LOGS
            // =====================================================

            modelBuilder.Entity<DemoActionLog>(b =>
            {
                b.HasKey(x => x.Id);

                b.HasIndex(x => x.DemoUserId);

                b.HasIndex(x => x.Timestamp);

                b.HasOne(x => x.DemoUser)
                    .WithMany()
                    .HasForeignKey(x => x.DemoUserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<DemoMonthlyReport>(b =>
            {
                b.HasKey(x => x.Id);
                b.HasIndex(x => x.ReportMonth);
                b.HasIndex(x => new { x.DemoUserId, x.ReportMonth }).IsUnique();
                b.HasOne(x => x.DemoUser)
                    .WithMany()
                    .HasForeignKey(x => x.DemoUserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
