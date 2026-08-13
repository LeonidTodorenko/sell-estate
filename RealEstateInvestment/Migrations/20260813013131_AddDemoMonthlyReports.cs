using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class AddDemoMonthlyReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DemoMonthlyReports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoUserId = table.Column<Guid>(type: "uuid", nullable: false),
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
                    table.PrimaryKey("PK_DemoMonthlyReports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DemoMonthlyReports_DemoUsers_DemoUserId",
                        column: x => x.DemoUserId,
                        principalTable: "DemoUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DemoMonthlyReports_DemoUserId_ReportMonth",
                table: "DemoMonthlyReports",
                columns: new[] { "DemoUserId", "ReportMonth" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DemoMonthlyReports_ReportMonth",
                table: "DemoMonthlyReports",
                column: "ReportMonth");

            migrationBuilder.Sql(@"
                INSERT INTO ""DemoMonthlyReports""
                    (""Id"", ""DemoUserId"", ""ReportMonth"", ""WalletBalance"",
                     ""InvestmentValue"", ""RentalIncome"", ""TotalCapital"",
                     ""CapitalChange"", ""GeneratedAt"")
                SELECT gen_random_uuid(), u.""Id"",
                       date_trunc('month', CURRENT_TIMESTAMP) - (m.n || ' months')::interval,
                       u.""WalletBalance"" - COALESCE(r.rent, 0) * m.n / 3,
                       COALESCE(i.investment, 0),
                       COALESCE(r.rent, 0) * (3 - m.n) / 3,
                       u.""WalletBalance"" - COALESCE(r.rent, 0) * m.n / 3 + COALESCE(i.investment, 0),
                       CASE WHEN m.n = 3 THEN 0 ELSE COALESCE(r.rent, 0) / 3 END,
                       CURRENT_TIMESTAMP
                FROM ""DemoUsers"" u
                CROSS JOIN generate_series(3, 0, -1) AS m(n)
                LEFT JOIN (
                    SELECT ""DemoUserId"", SUM(""InvestedAmount"") AS investment
                    FROM ""DemoInvestments"" GROUP BY ""DemoUserId"") i ON i.""DemoUserId"" = u.""Id""
                LEFT JOIN (
                    SELECT ""DemoInvestorId"", SUM(""Amount"") AS rent
                    FROM ""DemoRentalIncomes"" GROUP BY ""DemoInvestorId"") r ON r.""DemoInvestorId"" = u.""Id""
                WHERE NOT EXISTS (
                    SELECT 1 FROM ""DemoMonthlyReports"" existing
                    WHERE existing.""DemoUserId"" = u.""Id"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DemoMonthlyReports");
        }
    }
}
