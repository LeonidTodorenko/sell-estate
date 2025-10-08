using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using Resend;
 
namespace RealEstateInvestment.Services
{
    public class EmailService
    {
        private readonly IResend _resend;
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration config, AppDbContext context, ILogger<EmailService> logger, IResend resend)
        {
            _config = config;
            _context = context;
            _logger = logger;
            _resend = resend;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string htmlMessage)
        {
            var from = _config["Email:From"];
            var provider = _config["Email:Provider"];

            if (!string.Equals(provider, "Resend", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Email provider is not 'Resend' — skipping send.");
                await LogError("Provider not 'Resend'", toEmail);
                return;
            }

            if (string.IsNullOrWhiteSpace(from))
            {
                from = "onboarding@resend.dev"; // дефолт без домена
            }

            try
            {

                // Быстрый sanity-check: убедимся, что домен из From доступен этому ключу
                var fromDomain = GetDomainFromAddress(from);
                if (!string.Equals(fromDomain, "resend.dev", StringComparison.OrdinalIgnoreCase))
                {
                    var domainsResp = await _resend.DomainListAsync();
                    var domains = domainsResp.Content ;
                    var match = domains.FirstOrDefault(d =>
                        string.Equals(d.Name, fromDomain, StringComparison.OrdinalIgnoreCase) ||
                        // если вы подтвердили базовый домен, а шлёте с поддомена:
                        (fromDomain.EndsWith("." + d.Name, StringComparison.OrdinalIgnoreCase))
                    );

                    if (match == null)
                        _logger.LogWarning("From domain {Domain} не найден у этого API-ключа.", fromDomain);
                }


             

                var msg = new EmailMessage
                {
                    From = from,
                    To = toEmail,
                    Subject = subject,
                    HtmlBody = htmlMessage,
                };

                ResendResponse<Guid> resp = await _resend.EmailSendAsync(msg);
                _logger.LogInformation("Resend message sent to {To}. Id={Id}", toEmail, resp.Content);
            }
            catch (Exception ex)
            {
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add some guid later
                    Action = "SendEmailAsync error",
                    Details = ex.Message + toEmail,
                });

                _logger.LogError(ex, "SendEmailAsync failed for {To}", toEmail);
                await LogError(ex.Message, toEmail);

                await _context.SaveChangesAsync();
            }
        }

        private static string GetDomainFromAddress(string from)
        {
            // "Name <no-reply@send.todtech.ru>" -> "send.todtech.ru"
            var angle = from.IndexOf('<');
            var email = angle >= 0 ? from.Substring(angle + 1).Trim(' ', '>') : from.Trim();
            var at = email.LastIndexOf('@');
            return at >= 0 ? email.Substring(at + 1) : email;
        }

        public async Task SendToAdminAsync(string subject, string htmlMessage)
        {
            var adminEmail = _config["Email:Admin"];
            if (string.IsNullOrWhiteSpace(adminEmail))
            {
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add some guid later
                    Action = "SendToAdminAsync error",
                    Details = "Admin email not configured",
                });

                await LogError("Admin email not configured", "admin@unknown");
                await _context.SaveChangesAsync();
       
                return;
            }

            await SendEmailAsync(adminEmail, subject, htmlMessage);
        }
           
        private async Task LogError(string details, string toEmail)
        {
            try
            {
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"),
                    //UserId = Guid.TryParse(_config["SuperUser:Id"], out var uid) ? uid : Guid.Empty,
                    Action = "EmailError",
                    Details = $"{details} | to={toEmail}"
                });
                await _context.SaveChangesAsync();
            }
            catch { /* не даём логированию уронить поток */ }
        }
    }
}
