using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class BuybackPricePerShare : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BuybackPricePerShare",
                table: "Properties",
                type: "numeric",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Investments_PropertyId",
                table: "Investments",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_Investments_UserId",
                table: "Investments",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Investments_Properties_PropertyId",
                table: "Investments",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Investments_Users_UserId",
                table: "Investments",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Investments_Properties_PropertyId",
                table: "Investments");

            migrationBuilder.DropForeignKey(
                name: "FK_Investments_Users_UserId",
                table: "Investments");

            migrationBuilder.DropIndex(
                name: "IX_Investments_PropertyId",
                table: "Investments");

            migrationBuilder.DropIndex(
                name: "IX_Investments_UserId",
                table: "Investments");

            migrationBuilder.DropColumn(
                name: "BuybackPricePerShare",
                table: "Properties");
        }
    }
}
