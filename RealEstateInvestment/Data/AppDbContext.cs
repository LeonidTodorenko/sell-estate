using Microsoft.EntityFrameworkCore;
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

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
        }
    }
}
