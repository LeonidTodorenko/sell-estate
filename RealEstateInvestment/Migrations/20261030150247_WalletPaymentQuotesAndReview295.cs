using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class WalletPaymentQuotesAndReview295 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ChargeCurrency",
                table: "SandboxPayments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "ExchangeRate",
                table: "SandboxPayments",
                type: "numeric(18,8)",
                precision: 18,
                scale: 8,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "FeeAmount",
                table: "SandboxPayments",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "IsTest",
                table: "SandboxPayments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Method",
                table: "SandboxPayments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewedBy",
                table: "SandboxPayments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SettlementReference",
                table: "SandboxPayments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "SandboxPayments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WalletCurrency",
                table: "SandboxPayments",
                type: "text",
                nullable: false,
                defaultValue: "");

            // Preserve the verified 29.4 quotes; no ledger or wallet mutation.
            migrationBuilder.Sql("""
                UPDATE "SandboxPayments" SET "ChargeCurrency"='RUB', "WalletCurrency"='USD',
                    "IsTest"=TRUE, "Method"='yookassa',
                    "ExchangeRate"=CASE WHEN "WalletAmount">0 THEN "AmountRub"/"WalletAmount" ELSE 0 END;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_SandboxPayments_SettlementReference",
                table: "SandboxPayments",
                column: "SettlementReference",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SandboxPayments_SettlementReference",
                table: "SandboxPayments");

            migrationBuilder.DropColumn(
                name: "ChargeCurrency",
                table: "SandboxPayments");

            migrationBuilder.DropColumn(
                name: "ExchangeRate",
                table: "SandboxPayments");

            migrationBuilder.DropColumn(
                name: "FeeAmount",
                table: "SandboxPayments");

            migrationBuilder.DropColumn(
                name: "IsTest",
                table: "SandboxPayments");

            migrationBuilder.DropColumn(
                name: "Method",
                table: "SandboxPayments");

            migrationBuilder.DropColumn(
                name: "ReviewedBy",
                table: "SandboxPayments");

            migrationBuilder.DropColumn(
                name: "SettlementReference",
                table: "SandboxPayments");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "SandboxPayments");

            migrationBuilder.DropColumn(
                name: "WalletCurrency",
                table: "SandboxPayments");
        }
    }
}
