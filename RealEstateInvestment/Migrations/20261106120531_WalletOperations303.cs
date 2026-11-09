using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class WalletOperations303 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ProcessedAt",
                table: "WithdrawalRequests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ProcessedBy",
                table: "WithdrawalRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "WithdrawalRequests",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RequestKey",
                table: "WithdrawalRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TestDestination",
                table: "WithdrawalRequests",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "SandboxPayments",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_WithdrawalRequests_UserId_RequestKey",
                table: "WithdrawalRequests",
                columns: new[] { "UserId", "RequestKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WithdrawalRequests_UserId_RequestKey",
                table: "WithdrawalRequests");

            migrationBuilder.DropColumn(
                name: "ProcessedAt",
                table: "WithdrawalRequests");

            migrationBuilder.DropColumn(
                name: "ProcessedBy",
                table: "WithdrawalRequests");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "WithdrawalRequests");

            migrationBuilder.DropColumn(
                name: "RequestKey",
                table: "WithdrawalRequests");

            migrationBuilder.DropColumn(
                name: "TestDestination",
                table: "WithdrawalRequests");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "SandboxPayments");
        }
    }
}
