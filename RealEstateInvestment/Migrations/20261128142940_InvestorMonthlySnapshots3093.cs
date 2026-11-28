using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class InvestorMonthlySnapshots3093 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "InvestorMonthlyReports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReportMonth = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    WalletBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    InvestmentValue = table.Column<decimal>(type: "numeric", nullable: false),
                    RentalIncome = table.Column<decimal>(type: "numeric", nullable: false),
                    TotalCapital = table.Column<decimal>(type: "numeric", nullable: false),
                    CapitalChange = table.Column<decimal>(type: "numeric", nullable: false),
                    GeneratedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestorMonthlyReports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InvestorMonthlyReports_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InvestorMonthlyReports_UserId_ReportMonth",
                table: "InvestorMonthlyReports",
                columns: new[] { "UserId", "ReportMonth" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InvestorMonthlyReports");
        }
    }
}
