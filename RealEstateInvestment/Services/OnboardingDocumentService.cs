using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Services
{
    public interface IOnboardingDocumentService
    {
        byte[] GenerateRegistrationConfirmation(User user);
    }

    public class OnboardingDocumentService : IOnboardingDocumentService
    {
        public OnboardingDocumentService()
        {
            QuestPDF.Settings.License = LicenseType.Community;
        }

        public byte[] GenerateRegistrationConfirmation(User user)
        {
            var now = DateTime.UtcNow;

            var doc = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(30);

                    page.Header().Column(col =>
                    {
                        col.Item().Text("Registration Confirmation")
                            .FontSize(20).SemiBold();

                        col.Item().Text("Client ID / Account reference")
                            .FontSize(12).FontColor(Colors.Grey.Darken2);

                        col.Item().PaddingTop(10).LineHorizontal(1);
                    });

                    page.Content().Column(col =>
                    {
                        col.Item().Text($"Dear {user.FullName},").FontSize(12);

                        col.Item().PaddingTop(10).Text(t =>
                        {
                            t.Span("Your Client ID: ").SemiBold();
                            t.Span(user.ClientNumber).SemiBold().FontSize(14);
                        });

                        col.Item().PaddingTop(6).Text($"Email: {user.Email}").FontSize(11);
                        col.Item().Text($"Registered at: {user.CreatedAt:yyyy-MM-dd HH:mm} UTC").FontSize(11);

                        if (user.TermsAcceptedAt.HasValue)
                        {
                            col.Item().PaddingTop(6).Text($"Terms accepted: Yes").FontSize(11);
                            col.Item().Text($"Terms version: {user.TermsVersion ?? "v1"}").FontSize(11);
                            col.Item().Text($"Accepted at: {user.TermsAcceptedAt:yyyy-MM-dd HH:mm} UTC").FontSize(11);
                        }

                        col.Item().PaddingTop(12).Text("Next steps").FontSize(13).SemiBold();
                        col.Item().Text("1) Confirm your email").FontSize(11);
                        col.Item().Text("2) Complete KYC verification to unlock operations").FontSize(11);

                        col.Item().PaddingTop(12).Text("Support").FontSize(13).SemiBold();
                        col.Item().Text("When contacting support, please provide your Client ID and email.").FontSize(11);

                        col.Item().PaddingTop(14).LineHorizontal(1);

                        col.Item().PaddingTop(8).Text("Disclaimer")
                            .FontSize(12).SemiBold();

                        col.Item().Text("This document is a registration confirmation and is not a contract.")
                            .FontSize(10).FontColor(Colors.Grey.Darken2);
                    });

                    page.Footer().AlignRight().Text($"{now:yyyy-MM-dd HH:mm} UTC")
                        .FontSize(8).FontColor(Colors.Grey.Darken2);
                });
            });

            return doc.GeneratePdf();
        }
    }
}
