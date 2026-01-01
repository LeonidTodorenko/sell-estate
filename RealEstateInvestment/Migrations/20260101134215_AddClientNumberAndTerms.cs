using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class AddClientNumberAndTerms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ClientNumber",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TermsAcceptedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TermsVersion",
                table: "Users",
                type: "text",
                nullable: true);

            // заполняем всем существующим Users уникальный ClientNumber
            migrationBuilder.Sql(@"
        UPDATE ""Users""
        SET ""ClientNumber"" = 'CL' || upper(substr(md5(random()::text || ""Id""::text), 1, 8))
        WHERE ""ClientNumber"" IS NULL OR ""ClientNumber"" = '';
    ");

            // делаем NOT NULL
            migrationBuilder.AlterColumn<string>(
                name: "ClientNumber",
                table: "Users",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            // создаём UNIQUE INDEX
            migrationBuilder.CreateIndex(
                name: "IX_Users_ClientNumber",
                table: "Users",
                column: "ClientNumber",
                unique: true);
        }


        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_ClientNumber",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ClientNumber",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TermsAcceptedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TermsVersion",
                table: "Users");
        }

    }
}
