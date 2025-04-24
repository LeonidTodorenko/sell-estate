using MailKit.Net.Smtp;
using MimeKit;
//using System.Net.Mail;
//using System.Net;
//using SmtpClient = MailKit.Net.Smtp.SmtpClient;

namespace RealEstateInvestment.Services
{
    public class EmailService
    {
        private readonly IConfiguration _config;

        public EmailService(IConfiguration config)
        {
            _config = config;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string htmlMessage)
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

        public async Task SendToAdminAsync(string subject, string htmlMessage)
        {
            var adminEmail = _config["Email:Admin"];
            await SendEmailAsync(adminEmail, subject, htmlMessage);
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
