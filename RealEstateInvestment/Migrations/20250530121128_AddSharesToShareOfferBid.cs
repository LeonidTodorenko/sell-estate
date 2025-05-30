using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class AddSharesToShareOfferBid : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Shares",
                table: "ShareOfferBids",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Shares",
                table: "ShareOfferBids");
        }
    }
}
