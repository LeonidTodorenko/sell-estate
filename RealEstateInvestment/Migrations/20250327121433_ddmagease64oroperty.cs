using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class ddmagease64oroperty : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageBase64",
                table: "Properties",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageBase64",
                table: "Properties");
        }
    }
}
