using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class AddPropertyContentFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "About",
                table: "Properties",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExpectedYieldText",
                table: "Properties",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PlannedSaleDate",
                table: "Properties",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "About",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "ExpectedYieldText",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "PlannedSaleDate",
                table: "Properties");
        }
    }
}
