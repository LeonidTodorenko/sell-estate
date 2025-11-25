using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class PermissionsRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "Permissions",
                table: "Users",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "UserRole",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "ModerationRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Target = table.Column<short>(type: "smallint", nullable: false),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Field = table.Column<string>(type: "text", nullable: false),
                    OldValue = table.Column<string>(type: "text", nullable: false),
                    NewValue = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    RequestedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReviewedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewerComment = table.Column<string>(type: "text", nullable: true),
                    Fingerprint = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModerationRequests", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ModerationRequests_Fingerprint",
                table: "ModerationRequests",
                column: "Fingerprint");

            migrationBuilder.CreateIndex(
                name: "IX_ModerationRequests_Target_TargetId_Field_Status",
                table: "ModerationRequests",
                columns: new[] { "Target", "TargetId", "Field", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ModerationRequests");

            migrationBuilder.DropColumn(
                name: "Permissions",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "UserRole",
                table: "Users");
        }
    }
}
