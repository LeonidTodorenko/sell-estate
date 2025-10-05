using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class AddReferrals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ReferralInvites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InviterUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    InviteeEmail = table.Column<string>(type: "text", nullable: false),
                    CodeHash = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RedeemedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReferralInvites", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Referrals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InviterUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RefereeUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    InviteId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Referrals", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReferralInvites_CodeHash",
                table: "ReferralInvites",
                column: "CodeHash");

            migrationBuilder.CreateIndex(
                name: "IX_ReferralInvites_InviteeEmail",
                table: "ReferralInvites",
                column: "InviteeEmail");

            migrationBuilder.CreateIndex(
                name: "IX_ReferralInvites_InviterUserId",
                table: "ReferralInvites",
                column: "InviterUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Referrals_InviteId",
                table: "Referrals",
                column: "InviteId");

            migrationBuilder.CreateIndex(
                name: "IX_Referrals_InviterUserId",
                table: "Referrals",
                column: "InviterUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Referrals_RefereeUserId",
                table: "Referrals",
                column: "RefereeUserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReferralInvites");

            migrationBuilder.DropTable(
                name: "Referrals");
        }
    }
}
