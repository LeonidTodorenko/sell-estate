using MailKit.Net.Smtp;
using Microsoft.EntityFrameworkCore;
using MimeKit;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
//using System.Net.Mail;
//using System.Net;
//using SmtpClient = MailKit.Net.Smtp.SmtpClient;

namespace RealEstateInvestment.Services
{
    public class EmailService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public EmailService(IConfiguration config, AppDbContext context)
        {
            _config = config;
            _context = context;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string htmlMessage)
        {
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress("Real Estate App", _config["Email:From"]));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = subject;

                var bodyBuilder = new BodyBuilder { HtmlBody = htmlMessage };
                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                await client.ConnectAsync(_config["Email:SmtpServer"], int.Parse(_config["Email:Port"]), true);
                await client.AuthenticateAsync(_config["Email:Username"], _config["Email:Password"]);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add some guid later
                    Action = "SendEmailAsync error",
                    Details = ex.Message + toEmail,
                });
            }
          
        }

        public async Task SendToAdminAsync(string subject, string htmlMessage)
        {
            try
            {
                var adminEmail = _config["Email:Admin"];
                await SendEmailAsync(adminEmail, subject, htmlMessage);
            }
            catch (Exception ex)
            {
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add some guid later
                    Action = "SendToAdminAsync error",
                    Details = ex.Message,
                });
            }
          
        }

        //public async Task SendEmailAsync(string to, string subject, string html)
        //{
        //    var smtpClient = new SmtpClient(_config["Email:SmtpServer"])
        //    {
        //        Port = int.Parse(_config["Email:Port"]),
        //        Credentials = new NetworkCredential(
        //            _config["Email:Username"],
        //            _config["Email:Password"]
        //        ),
        //        EnableSsl = true
        //    };

        //    var mail = new MailMessage
        //    {
        //        From = new MailAddress(_config["Email:From"]),
        //        Subject = subject,
        //        Body = html,
        //        IsBodyHtml = true
        //    };

        //    mail.To.Add(to);

        //    await smtpClient.SendMailAsync(mail);
        //}
    }
}
