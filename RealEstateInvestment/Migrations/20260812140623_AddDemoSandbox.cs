using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateInvestment.Migrations
{
    /// <inheritdoc />
    public partial class AddDemoSandbox : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DemoUsers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoCode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FullName = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    SecretWord = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "text", nullable: false),
                    UserRole = table.Column<int>(type: "integer", nullable: false),
                    Permissions = table.Column<long>(type: "bigint", nullable: false),
                    KycStatus = table.Column<string>(type: "text", nullable: false),
                    IsBlocked = table.Column<bool>(type: "boolean", nullable: false),
                    WalletBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    PhoneNumber = table.Column<string>(type: "text", nullable: true),
                    Address = table.Column<string>(type: "text", nullable: true),
                    AvatarBase64 = table.Column<string>(type: "text", nullable: true),
                    IsEmailConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    ClientNumber = table.Column<string>(type: "text", nullable: false),
                    TermsAcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TermsVersion = table.Column<string>(type: "text", nullable: true),
                    KycContractSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    KycContractVersion = table.Column<string>(type: "text", nullable: true),
                    PinCode = table.Column<string>(type: "text", nullable: true),
                    IsTemplate = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastActiveAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemoUsers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DemoActionLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    Details = table.Column<string>(type: "text", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemoActionLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DemoActionLogs_DemoUsers_DemoUserId",
                        column: x => x.DemoUserId,
                        principalTable: "DemoUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DemoInvestmentApplications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    RequestedShares = table.Column<int>(type: "integer", nullable: false),
                    ApprovedShares = table.Column<int>(type: "integer", nullable: true),
                    ApprovedAmount = table.Column<decimal>(type: "numeric", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    IsPriority = table.Column<bool>(type: "boolean", nullable: false),
                    StepNumber = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemoInvestmentApplications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DemoInvestmentApplications_DemoUsers_DemoUserId",
                        column: x => x.DemoUserId,
                        principalTable: "DemoUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DemoInvestmentApplications_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DemoInvestments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Shares = table.Column<int>(type: "integer", nullable: false),
                    InvestedAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemoInvestments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DemoInvestments_DemoUsers_DemoUserId",
                        column: x => x.DemoUserId,
                        principalTable: "DemoUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DemoInvestments_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DemoKycDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Base64File = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemoKycDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DemoKycDocuments_DemoUsers_DemoUserId",
                        column: x => x.DemoUserId,
                        principalTable: "DemoUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DemoMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    DemoRecipientId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemoMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DemoMessages_DemoUsers_DemoRecipientId",
                        column: x => x.DemoRecipientId,
                        principalTable: "DemoUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DemoRentalIncomes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoInvestorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    PayoutDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemoRentalIncomes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DemoRentalIncomes_DemoUsers_DemoInvestorId",
                        column: x => x.DemoInvestorId,
                        principalTable: "DemoUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DemoRentalIncomes_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DemoShareTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoBuyerId = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoSellerId = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Shares = table.Column<int>(type: "integer", nullable: false),
                    PricePerShare = table.Column<decimal>(type: "numeric", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemoShareTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DemoShareTransactions_DemoUsers_DemoBuyerId",
                        column: x => x.DemoBuyerId,
                        principalTable: "DemoUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DemoShareTransactions_DemoUsers_DemoSellerId",
                        column: x => x.DemoSellerId,
                        principalTable: "DemoUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DemoShareTransactions_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DemoUserTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    Shares = table.Column<int>(type: "integer", nullable: true),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: true),
                    PropertyTitle = table.Column<string>(type: "text", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemoUserTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DemoUserTransactions_DemoUsers_DemoUserId",
                        column: x => x.DemoUserId,
                        principalTable: "DemoUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DemoUserTransactions_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DemoShareOffers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoSellerId = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoInvestmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    SharesForSale = table.Column<int>(type: "integer", nullable: false),
                    LockedInvestedAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    StartPricePerShare = table.Column<decimal>(type: "numeric", nullable: false),
                    BuyoutPricePerShare = table.Column<decimal>(type: "numeric", nullable: true),
                    ExpirationDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemoShareOffers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DemoShareOffers_DemoInvestments_DemoInvestmentId",
                        column: x => x.DemoInvestmentId,
                        principalTable: "DemoInvestments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_DemoShareOffers_DemoUsers_DemoSellerId",
                        column: x => x.DemoSellerId,
                        principalTable: "DemoUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DemoShareOffers_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DemoShareOfferBids",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoOfferId = table.Column<Guid>(type: "uuid", nullable: false),
                    DemoBidderId = table.Column<Guid>(type: "uuid", nullable: false),
                    BidPricePerShare = table.Column<decimal>(type: "numeric", nullable: false),
                    Shares = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemoShareOfferBids", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DemoShareOfferBids_DemoShareOffers_DemoOfferId",
                        column: x => x.DemoOfferId,
                        principalTable: "DemoShareOffers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DemoShareOfferBids_DemoUsers_DemoBidderId",
                        column: x => x.DemoBidderId,
                        principalTable: "DemoUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DemoActionLogs_DemoUserId",
                table: "DemoActionLogs",
                column: "DemoUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoActionLogs_Timestamp",
                table: "DemoActionLogs",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_DemoInvestmentApplications_DemoUserId",
                table: "DemoInvestmentApplications",
                column: "DemoUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoInvestmentApplications_DemoUserId_Status",
                table: "DemoInvestmentApplications",
                columns: new[] { "DemoUserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_DemoInvestmentApplications_PropertyId",
                table: "DemoInvestmentApplications",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoInvestments_DemoUserId",
                table: "DemoInvestments",
                column: "DemoUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoInvestments_DemoUserId_PropertyId",
                table: "DemoInvestments",
                columns: new[] { "DemoUserId", "PropertyId" });

            migrationBuilder.CreateIndex(
                name: "IX_DemoInvestments_PropertyId",
                table: "DemoInvestments",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoKycDocuments_DemoUserId",
                table: "DemoKycDocuments",
                column: "DemoUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoKycDocuments_DemoUserId_Status",
                table: "DemoKycDocuments",
                columns: new[] { "DemoUserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_DemoMessages_CreatedAt",
                table: "DemoMessages",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_DemoMessages_DemoRecipientId",
                table: "DemoMessages",
                column: "DemoRecipientId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoRentalIncomes_DemoInvestorId",
                table: "DemoRentalIncomes",
                column: "DemoInvestorId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoRentalIncomes_PayoutDate",
                table: "DemoRentalIncomes",
                column: "PayoutDate");

            migrationBuilder.CreateIndex(
                name: "IX_DemoRentalIncomes_PropertyId",
                table: "DemoRentalIncomes",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoShareOfferBids_DemoBidderId",
                table: "DemoShareOfferBids",
                column: "DemoBidderId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoShareOfferBids_DemoOfferId",
                table: "DemoShareOfferBids",
                column: "DemoOfferId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoShareOffers_DemoInvestmentId",
                table: "DemoShareOffers",
                column: "DemoInvestmentId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoShareOffers_DemoSellerId",
                table: "DemoShareOffers",
                column: "DemoSellerId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoShareOffers_ExpirationDate",
                table: "DemoShareOffers",
                column: "ExpirationDate");

            migrationBuilder.CreateIndex(
                name: "IX_DemoShareOffers_IsActive",
                table: "DemoShareOffers",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_DemoShareOffers_PropertyId",
                table: "DemoShareOffers",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoShareTransactions_DemoBuyerId",
                table: "DemoShareTransactions",
                column: "DemoBuyerId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoShareTransactions_DemoSellerId",
                table: "DemoShareTransactions",
                column: "DemoSellerId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoShareTransactions_PropertyId",
                table: "DemoShareTransactions",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoShareTransactions_Timestamp",
                table: "DemoShareTransactions",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_DemoUsers_ClientNumber",
                table: "DemoUsers",
                column: "ClientNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DemoUsers_DemoCode",
                table: "DemoUsers",
                column: "DemoCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DemoUsers_Email",
                table: "DemoUsers",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DemoUsers_ExpiresAt",
                table: "DemoUsers",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_DemoUsers_IsActive",
                table: "DemoUsers",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_DemoUsers_IsTemplate",
                table: "DemoUsers",
                column: "IsTemplate",
                unique: true,
                filter: "\"IsTemplate\" = true");

            migrationBuilder.CreateIndex(
                name: "IX_DemoUserTransactions_DemoUserId",
                table: "DemoUserTransactions",
                column: "DemoUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoUserTransactions_DemoUserId_Timestamp",
                table: "DemoUserTransactions",
                columns: new[] { "DemoUserId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_DemoUserTransactions_PropertyId",
                table: "DemoUserTransactions",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_DemoUserTransactions_Timestamp",
                table: "DemoUserTransactions",
                column: "Timestamp");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DemoActionLogs");

            migrationBuilder.DropTable(
                name: "DemoInvestmentApplications");

            migrationBuilder.DropTable(
                name: "DemoKycDocuments");

            migrationBuilder.DropTable(
                name: "DemoMessages");

            migrationBuilder.DropTable(
                name: "DemoRentalIncomes");

            migrationBuilder.DropTable(
                name: "DemoShareOfferBids");

            migrationBuilder.DropTable(
                name: "DemoShareTransactions");

            migrationBuilder.DropTable(
                name: "DemoUserTransactions");

            migrationBuilder.DropTable(
                name: "DemoShareOffers");

            migrationBuilder.DropTable(
                name: "DemoInvestments");

            migrationBuilder.DropTable(
                name: "DemoUsers");
        }
    }
}
