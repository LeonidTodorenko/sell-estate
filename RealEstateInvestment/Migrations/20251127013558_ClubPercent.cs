using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class ClubPercent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ReferrerRewardPercent",
                table: "Referrals",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "RewardValidUntil",
                table: "Referrals",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<decimal>(
                name: "ReferrerRewardPercent",
                table: "ReferralInvites",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "ReferrerRewardYears",
                table: "ReferralInvites",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReferrerRewardPercent",
                table: "Referrals");

            migrationBuilder.DropColumn(
                name: "RewardValidUntil",
                table: "Referrals");

            migrationBuilder.DropColumn(
                name: "ReferrerRewardPercent",
                table: "ReferralInvites");

            migrationBuilder.DropColumn(
                name: "ReferrerRewardYears",
                table: "ReferralInvites");
        }
    }
}
