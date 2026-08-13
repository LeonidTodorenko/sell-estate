using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateInvestment.Data;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260813002112_AddDemoMonthlyPayoutIdempotency")]
    partial class AddDemoMonthlyPayoutIdempotency
    {
        protected override void BuildTargetModel(Microsoft.EntityFrameworkCore.ModelBuilder modelBuilder)
        {
        }
    }
}
