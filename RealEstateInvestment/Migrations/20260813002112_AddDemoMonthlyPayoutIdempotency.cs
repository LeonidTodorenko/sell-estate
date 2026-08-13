using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    public partial class AddDemoMonthlyPayoutIdempotency : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PayoutMonth", table: "DemoRentalIncomes",
                type: "timestamp with time zone", nullable: true);
            migrationBuilder.Sql(
                "UPDATE \"DemoRentalIncomes\" SET \"PayoutMonth\" = " +
                "date_trunc('month', \"PayoutDate\" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'");
            migrationBuilder.AlterColumn<DateTime>(
                name: "PayoutMonth", table: "DemoRentalIncomes",
                type: "timestamp with time zone", nullable: false,
                oldClrType: typeof(DateTime), oldType: "timestamp with time zone", oldNullable: true);
            migrationBuilder.CreateIndex(
                name: "IX_DemoRentalIncomes_DemoInvestorId_PropertyId_PayoutMonth",
                table: "DemoRentalIncomes",
                columns: new[] { "DemoInvestorId", "PropertyId", "PayoutMonth" }, unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_DemoRentalIncomes_DemoInvestorId_PropertyId_PayoutMonth",
                table: "DemoRentalIncomes");
            migrationBuilder.DropColumn(name: "PayoutMonth", table: "DemoRentalIncomes");
        }
    }
}
