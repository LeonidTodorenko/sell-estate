using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class AddShareOffer2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PropertyId",
                table: "ShareOffers",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_ShareOffers_PropertyId",
                table: "ShareOffers",
                column: "PropertyId");

            migrationBuilder.AddForeignKey(
                name: "FK_ShareOffers_Properties_PropertyId",
                table: "ShareOffers",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ShareOffers_Properties_PropertyId",
                table: "ShareOffers");

            migrationBuilder.DropIndex(
                name: "IX_ShareOffers_PropertyId",
                table: "ShareOffers");

            migrationBuilder.DropColumn(
                name: "PropertyId",
                table: "ShareOffers");
        }
    }
}
