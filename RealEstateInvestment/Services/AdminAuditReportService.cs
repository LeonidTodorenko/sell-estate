using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using System.Linq;

namespace RealEstateInvestment.Services
{
    public interface IAdminAuditReportService
    {
        Task GenerateAndSendAdminAuditAsync(DateTime fromDate, DateTime toDate);
    }

    public class AdminAuditReportService : IAdminAuditReportService
    {
        private readonly AppDbContext _db;
        private readonly EmailService _email;
        private readonly IConfiguration _cfg;
        private readonly ILogger<AdminAuditReportService> _logger;

        public AdminAuditReportService(
            AppDbContext db,
            EmailService email,
            IConfiguration cfg,
            ILogger<AdminAuditReportService> logger)
        {
            _db = db;
            _email = email;
            _cfg = cfg;
            _logger = logger;
        }

        public async Task GenerateAndSendAdminAuditAsync(DateTime fromDate, DateTime toDate)
        {
            try
            {
                var adminEmail = _cfg["Email:Admin"];
                if (string.IsNullOrWhiteSpace(adminEmail))
                {
                    _logger.LogWarning("AdminAuditReport: Email:Admin is not configured");
                    return;
                }

                // 1) Тянем логи с юзерами
                var logs = await
                    (from log in _db.ActionLogs
                     join u in _db.Users on log.UserId equals u.Id into lj
                     from userInfo in lj.DefaultIfEmpty()
                     where log.Timestamp >= fromDate && log.Timestamp <= toDate
                     orderby log.Timestamp
                     select new AuditLogRow
                     {
                         Id = log.Id,
                         UserId = log.UserId,
                         UserName = userInfo != null ? userInfo.FullName : null,
                         UserEmail = userInfo != null ? userInfo.Email : null,
                         Action = log.Action,
                         Details = log.Details,
                         Timestamp = log.Timestamp
                     })
                    .ToListAsync();

                if (!logs.Any())
                {
                    _logger.LogInformation(
                        "AdminAuditReport: no logs for period {From} - {To}",
                        fromDate, toDate);
                    return;
                }

                // 2) Готовим CSV
                var csv = BuildCsv(logs, fromDate, toDate);
                var bytes = Encoding.UTF8.GetPreamble()
                    .Concat(Encoding.UTF8.GetBytes(csv))
                    .ToArray();

                var subject = $"Audit log report {fromDate:yyyy-MM-dd} – {toDate:yyyy-MM-dd}";
                var body = $"<p>Audit log report for period {fromDate:yyyy-MM-dd} – {toDate:yyyy-MM-dd} is attached.</p>";

                await _email.SendEmailWithAttachmentAsync(
                    adminEmail,
                    subject,
                    body,
                    $"audit-log-{fromDate:yyyyMMdd}-{toDate:yyyyMMdd}.csv",
                    bytes,
                    "text/csv"
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "AdminAuditReportService failed");

                _db.ActionLogs.Add(new ActionLog
                {
                    UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"),
                    Action = "AdminAuditReportService error",
                    Details = ex.Message
                });
                await _db.SaveChangesAsync();
                throw;
            }
        }

        private static string BuildCsv(
            IEnumerable<AuditLogRow> logs,
            DateTime fromDate,
            DateTime toDate)
        {
            var sb = new StringBuilder();

            // Шапка
            sb.AppendLine($"\"Audit log report\";\"{fromDate:yyyy-MM-dd}\";\"{toDate:yyyy-MM-dd}\"");
            sb.AppendLine();
            sb.AppendLine("Timestamp;UserId;UserName;UserEmail;Action;Details");

            foreach (var l in logs)
            {
                // локальная функция для экранирования
                string Esc(string? s)
                {
                    if (string.IsNullOrEmpty(s))
                        return string.Empty;

                    return s.Replace("\"", "\"\"");
                }

                sb.Append('"').Append(l.Timestamp.ToString("yyyy-MM-dd HH:mm:ss")).Append('"').Append(';');
                sb.Append('"').Append(l.UserId.ToString()).Append('"').Append(';');
                sb.Append('"').Append(Esc(l.UserName)).Append('"').Append(';');
                sb.Append('"').Append(Esc(l.UserEmail)).Append('"').Append(';');
                sb.Append('"').Append(Esc(l.Action)).Append('"').Append(';');
                sb.Append('"').Append(Esc(l.Details)).Append('"').AppendLine();
            }

            return sb.ToString();
        }

        private class AuditLogRow
        {
            public Guid Id { get; set; }
            public Guid UserId { get; set; }
            public string? UserName { get; set; }
            public string? UserEmail { get; set; }
            public string Action { get; set; } = "";
            public string Details { get; set; } = "";
            public DateTime Timestamp { get; set; }
        }
    }
}
