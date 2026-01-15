namespace RealEstateInvestment.Services
{
    using QuestPDF.Fluent;
    using QuestPDF.Helpers;
    using QuestPDF.Infrastructure;
    using RealEstateInvestment.Data;
    using RealEstateInvestment.Models;
    using Microsoft.EntityFrameworkCore;

    public interface IKycContractService
    {
        Task GenerateAndSendContractAsync(Guid userId);
    }

    public class KycContractService : IKycContractService
    {
        private readonly AppDbContext _db;
        private readonly EmailService _email;
        private readonly ILogger<KycContractService> _logger;

        public KycContractService(AppDbContext db, EmailService email, ILogger<KycContractService> logger)
        {
            _db = db;
            _email = email;
            _logger = logger;

            QuestPDF.Settings.License = LicenseType.Community;
        }

        public async Task GenerateAndSendContractAsync(Guid userId)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null || string.IsNullOrWhiteSpace(user.Email))
            {
                _logger.LogWarning("Contract: user not found or no email. {UserId}", userId);
                return;
            }

            // если уже отправляли — ничего не делаем
            if (user.KycContractSentAt != null)
            {
                _logger.LogInformation("Contract already sent to user {UserId} at {SentAt}", userId, user.KycContractSentAt);
                return;
            }

            //  client number обязателен
            if (string.IsNullOrWhiteSpace(user.ClientNumber))
            {
                user.ClientNumber = Helpers.ClientNumberGenerator.Generate();
                await _db.SaveChangesAsync();
            }

            // 2) Generate PDF
            var pdfBytes = GenerateContractPdf(user);

            var subject = "Your Investment Agreement";
            var html =
                $"<p>Hello, {System.Net.WebUtility.HtmlEncode(user.FullName)}!</p>" +
                $"<p>Congratulations — your KYC verification is approved.</p>" +
                $"<p>Your client number: <b>{System.Net.WebUtility.HtmlEncode(user.ClientNumber)}</b></p>" +
                $"<p>Please find your Investment Agreement attached.</p>";

            await _email.SendEmailWithAttachmentAsync(
                user.Email,
                subject,
                html,
                $"investment-agreement-{user.ClientNumber}.pdf",
                pdfBytes
            );

            user.KycContractSentAt = DateTime.UtcNow;
            user.KycContractVersion = "v1";  

            _db.ActionLogs.Add(new ActionLog
            {
                UserId = user.Id,
                Action = "Send KYC Contract",
                Details = $"Contract sent. ClientNumber={user.ClientNumber}"
            });
            await _db.SaveChangesAsync();
        }
         
        private static byte[] GenerateContractPdf(User user)
        {
            var doc = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(35);

                    page.Header().Column(h =>
                    {
                        h.Item().Text("INVESTMENT PLATFORM AGREEMENT").FontSize(18).SemiBold();
                        h.Item().Text($"Client: {user.FullName}").FontSize(11);
                        h.Item().Text($"Client number: {user.ClientNumber}").FontSize(11);
                        h.Item().Text($"Date: {DateTime.UtcNow:yyyy-MM-dd} (UTC)").FontSize(10).FontColor(Colors.Grey.Darken2);
                        h.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                    });

                    page.Content().PaddingTop(10).Column(c =>
                    {
                        c.Spacing(8);

                        c.Item().Text("1. Parties").SemiBold();
                        c.Item().Text("This Agreement is made between the Platform and the Client...");

                        c.Item().Text("2. KYC / Compliance").SemiBold();
                        c.Item().Text("Client has completed identity verification (KYC). The platform may request additional documents...");

                        c.Item().Text("3. Investment Risks").SemiBold();
                        c.Item().Text("Investments involve risks. Past performance does not guarantee future results...");

                        c.Item().Text("4. Fees & Operations").SemiBold();
                        c.Item().Text("Fees, commissions and execution rules are described in the platform policies...");

                        c.Item().Text("5. Acceptance").SemiBold();
                        c.Item().Text("By using the platform, the client accepts the terms of this agreement.");

                        c.Item().PaddingTop(20).Text("Client signature: ______________________").FontSize(11);
                        c.Item().Text("Platform representative: _______________").FontSize(11);
                    });

                    page.Footer().AlignRight().Text(t =>
                    {
                        t.Span("Page ").FontSize(9);
                        t.CurrentPageNumber().FontSize(9);
                        t.Span(" / ").FontSize(9);
                        t.TotalPages().FontSize(9);
                    });
                });
            });

            return doc.GeneratePdf();
        }
    }

}
