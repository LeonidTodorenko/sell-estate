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
        }
       
    }
}
