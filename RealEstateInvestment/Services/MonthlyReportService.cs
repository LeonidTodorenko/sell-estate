using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;
using System.Linq;

namespace RealEstateInvestment.Services
{
    public interface IMonthlyReportService
    {
        Task GenerateAndSendMonthlyReportAsync(Guid userId, DateTime periodStart);
    }

    public class MonthlyReportService : IMonthlyReportService
    {
        private readonly AppDbContext _db;
        private readonly EmailService _email;
        private readonly ILogger<MonthlyReportService> _logger;

        public MonthlyReportService(AppDbContext db, EmailService email, ILogger<MonthlyReportService> logger)
        {
            _db = db;
            _email = email;
            _logger = logger;

            // QuestPDF: Community лицензия
            QuestPDF.Settings.License = LicenseType.Community;
        }

        public async Task GenerateAndSendMonthlyReportAsync(Guid userId, DateTime periodStart)
        {
            try
            {
                var periodEnd = periodStart.AddMonths(1).AddTicks(-1);

                var user = await _db.Users.FindAsync(userId);
                if (user == null || string.IsNullOrWhiteSpace(user.Email))
                {
                    _logger.LogWarning("Monthly report: user {UserId} not found or no email.", userId);
                    return;
                }

                // === 1) Все транзакции до конца периода ===
                var allTx = await _db.UserTransactions
                    .Where(t => t.UserId == userId && t.Timestamp <= periodEnd)
                    .OrderBy(t => t.Timestamp)
                    .ToListAsync();

                // === 2) Истории: общий/капитал/аренда ===
                var assetMap = new SortedDictionary<string, decimal>();  // общий (equity + rent)
                var equityMap = new SortedDictionary<string, decimal>(); // без аренды
                var rentMap = new SortedDictionary<string, decimal>();   // только аренда

                decimal runningTotalAll = 0m;
                decimal runningEquity = 0m;
                decimal runningRent = 0m;
                decimal totalRentForPeriod = 0m;

                foreach (var tx in allTx)
                {
                    var dateStr = tx.Timestamp.ToString("yyyy-MM-dd");

                    var deltaAll = tx.Type switch
                    {
                        TransactionType.Deposit => tx.Amount,
                        TransactionType.ShareMarketSell => tx.Amount,
                        TransactionType.RentIncome => tx.Amount,
                        TransactionType.Investment => -tx.Amount,
                        TransactionType.Withdrawal => -tx.Amount,
                        TransactionType.Buyback => -tx.Amount,
                        TransactionType.ShareMarketBuy => -tx.Amount,
                        _ => 0m
                    };
                    runningTotalAll += deltaAll;

                    var deltaEquity = tx.Type switch
                    {
                        TransactionType.Deposit => tx.Amount,
                        TransactionType.ShareMarketSell => tx.Amount,
                        TransactionType.Investment => -tx.Amount,
                        TransactionType.Withdrawal => -tx.Amount,
                        TransactionType.Buyback => -tx.Amount,
                        TransactionType.ShareMarketBuy => -tx.Amount,
                        // RentIncome игнорируем
                        _ => 0m
                    };
                    runningEquity += deltaEquity;

                    if (tx.Type == TransactionType.RentIncome)
                    {
                        runningRent += tx.Amount;

                        if (tx.Timestamp >= periodStart && tx.Timestamp <= periodEnd)
                            totalRentForPeriod += tx.Amount;
                    }

                    assetMap[dateStr] = Math.Round(runningTotalAll, 2);
                    equityMap[dateStr] = Math.Round(runningEquity, 2);
                    rentMap[dateStr] = Math.Round(runningRent, 2);
                }

                // === 3) Значения на начало и конец месяца ===
                decimal assetsStart = 0m, assetsEnd = 0m;
                decimal equityStart = 0m, equityEnd = 0m;

                string startStr = periodStart.ToString("yyyy-MM-dd");
                string endStr = periodEnd.ToString("yyyy-MM-dd");

                foreach (var kv in assetMap)
                {
                    if (string.Compare(kv.Key, startStr, StringComparison.Ordinal) < 0)
                    {
                        assetsStart = kv.Value;
                        if (equityMap.TryGetValue(kv.Key, out var eqVal))
                            equityStart = eqVal;
                    }
                }

                foreach (var kv in assetMap)
                {
                    if (string.Compare(kv.Key, endStr, StringComparison.Ordinal) <= 0)
                    {
                        assetsEnd = kv.Value;
                        if (equityMap.TryGetValue(kv.Key, out var eqVal))
                            equityEnd = eqVal;
                    }
                }

                var totalPnl = assetsEnd - assetsStart;
                var equityPnl = equityEnd - equityStart;

                // Транзакции только за месяц
                var monthTx = allTx
                    .Where(t => t.Timestamp >= periodStart && t.Timestamp <= periodEnd)
                    .OrderBy(t => t.Timestamp)
                    .ToList();

                //расчёт сумм по типам:
                var totalDeposits = monthTx.Where(t => t.Type == TransactionType.Deposit).Sum(t => t.Amount);
                var totalWithdrawals = monthTx.Where(t => t.Type == TransactionType.Withdrawal).Sum(t => t.Amount);
                var totalInvestments = monthTx.Where(t => t.Type == TransactionType.Investment).Sum(t => t.Amount);
                var totalShareBuys = monthTx.Where(t => t.Type == TransactionType.ShareMarketBuy).Sum(t => t.Amount);
                var totalShareSells = monthTx.Where(t => t.Type == TransactionType.ShareMarketSell).Sum(t => t.Amount);
                var totalBuybacks = monthTx.Where(t => t.Type == TransactionType.Buyback).Sum(t => t.Amount);
                var totalRentIncomeOps = monthTx.Where(t => t.Type == TransactionType.RentIncome).Sum(t => t.Amount);

                // общий кэш-флоу за месяц (как двигание денег на кошельке, без переоценки активов):
                var netCashflow =
                    totalDeposits
                  + totalShareSells
                  + totalRentIncomeOps
                  - totalInvestments
                  - totalShareBuys
                  - totalWithdrawals
                  - totalBuybacks;

                // === 4) Сформируем текущие холдинги (по объектам) ===
                var rawHoldings = await _db.Investments
                    .Where(i => i.UserId == userId && i.Shares > 0)
                    .Include(i => i.Property)
                    .Select(i => new
                    {
                        i.PropertyId,
                        i.Shares,
                        CostPerShare = i.Shares > 0 ? (i.InvestedAmount / i.Shares) : 0m,
                        Title = i.Property.Title,
                        CurrentPps = (i.Property.BuybackPricePerShare.HasValue && i.Property.BuybackPricePerShare.Value > 0)
                            ? i.Property.BuybackPricePerShare.Value
                            : (i.Property.TotalShares > 0 ? (i.Property.Price / i.Property.TotalShares) : 0m)
                    })
                    .ToListAsync();

                var holdings = rawHoldings
                    .GroupBy(x => new { x.PropertyId, x.Title, x.CurrentPps })
                    .Select(g => new HoldingRow
                    {
                        PropertyId = g.Key.PropertyId,
                        Title = g.Key.Title ?? "",
                        Shares = g.Sum(z => z.Shares),
                        CostPps = g.Sum(z => z.CostPerShare * z.Shares) / Math.Max(1, g.Sum(z => z.Shares)),
                        CurrentPps = g.Key.CurrentPps
                    })
                    .OrderByDescending(h => h.MarketValue)
                    .ToList();

                // === 4.1 Картинки для объектов (ЗАКОММЕНТИРОВАНО, только для тестов позже) ===
                /*
                var propIds = holdings.Select(h => h.PropertyId).Distinct().ToList();

                var images = await _db.PropertyImages
                    .Where(pi => propIds.Contains(pi.PropertyId))
                    .GroupBy(pi => pi.PropertyId)
                    .Select(g => new
                    {
                        PropertyId = g.Key,
                        FirstImage = g.OrderBy(x => x.Id).FirstOrDefault()
                    })
                    .ToListAsync();

                var imageByProperty = new Dictionary<Guid, byte[]>();
                foreach (var x in images)
                {
                    var img = x.FirstImage;
                    if (img == null)
                        continue;

                    if (string.IsNullOrWhiteSpace(img.Base64Data))
                        continue;

                    var bytes = SafeDecodeBase64(img.Base64Data);
                    if (bytes != null)
                        imageByProperty[x.PropertyId] = bytes;
                }
                */

                // === 5) Генерим PDF (пока БЕЗ картинок) ===
                var pdfBytes = GeneratePdfReport(
                        user,
                        periodStart,
                        periodEnd,
                        assetsStart,
                        assetsEnd,
                        equityStart,
                        equityEnd,
                        totalRentForPeriod,
                        totalPnl,
                        equityPnl,
                        monthTx,
                        holdings,
                        totalDeposits,
                        totalWithdrawals,
                        totalInvestments,
                        totalShareBuys,
                        totalShareSells,
                        totalBuybacks,
                        totalRentIncomeOps,
                        netCashflow
                );

                var title = $"Monthly report {periodStart:yyyy-MM}";

                await _email.SendEmailWithAttachmentAsync(
                    user.Email,
                    title,
                    $"<p>Hello, {System.Net.WebUtility.HtmlEncode(user.FullName)}!</p>" +
                    $"<p>We attached your report for period {periodStart:yyyy-MM}.</p>",
                    $"monthly-report-{periodStart:yyyy-MM}.pdf",
                    pdfBytes
                );
            }
            catch (Exception ex)
            {
                _db.ActionLogs.Add(new ActionLog
                {
                    UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo check
                    Action = "GenerateAndSendMonthlyReportAsync error",
                    Details = ex.Message,
                });
                await _db.SaveChangesAsync();
                throw;
            }
        }

        // === PDF генерация через QuestPDF ===
        private byte[] GeneratePdfReport(
                      User user,
                      DateTime from,
                      DateTime to,
                      decimal assetsStart,
                      decimal assetsEnd,
                      decimal equityStart,
                      decimal equityEnd,
                      decimal rentForPeriod,
                      decimal totalPnl,
                      decimal equityPnl,
                      List<UserTransaction> txs,
                      List<HoldingRow> holdings,
                      decimal totalDeposits,
                      decimal totalWithdrawals,
                      decimal totalInvestments,
                      decimal totalShareBuys,
                      decimal totalShareSells,
                      decimal totalBuybacks,
                      decimal totalRentIncomeOps,
                      decimal netCashflow
                  )
        {
            var culture = System.Globalization.CultureInfo.InvariantCulture;

            var doc = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Margin(30);
                    page.Size(PageSizes.A4);

                    page.Header().Row(row =>
                    {
                        row.RelativeItem().Column(col =>
                        {
                            col.Item().Text($"Monthly report {from:yyyy-MM}")
                                .FontSize(20).SemiBold();
                            col.Item().Text($"User: {user.FullName} ({user.Email})")
                                .FontSize(10);
                            col.Item().Text($"Period: {from:yyyy-MM-dd} – {to:yyyy-MM-dd}")
                                .FontSize(10);
                        });
                    });

                    page.Content().Column(col =>
                    {
                        // Summary
                        col.Item().PaddingBottom(10).Column(summary =>
                        {
                            summary.Item().Text("Summary").FontSize(14).SemiBold().Underline();

                            summary.Item().Text(txt =>
                            {
                                txt.Span("Total assets at start: ").SemiBold().FontSize(10);
                                txt.Span($"{assetsStart.ToString("F2", culture)} USD").FontSize(10);
                            });

                            summary.Item().Text(txt =>
                            {
                                txt.Span("Total assets at end: ").SemiBold().FontSize(10);
                                txt.Span($"{assetsEnd.ToString("F2", culture)} USD").FontSize(10);
                            });

                            summary.Item().Text(txt =>
                            {
                                txt.Span("Change (P&L): ").SemiBold().FontSize(10)
                                   .FontColor(totalPnl >= 0 ? Colors.Green.Darken2 : Colors.Red.Darken2);
                                txt.Span($"{totalPnl.ToString("F2", culture)} USD").FontSize(10)
                                   .FontColor(totalPnl >= 0 ? Colors.Green.Darken2 : Colors.Red.Darken2);
                            });

                            summary.Item().Text(txt =>
                            {
                                txt.Span("Equity change (without rent): ").SemiBold().FontSize(10)
                                   .FontColor(equityPnl >= 0 ? Colors.Green.Darken2 : Colors.Red.Darken2);
                                txt.Span($"{equityPnl.ToString("F2", culture)} USD").FontSize(10)
                                   .FontColor(equityPnl >= 0 ? Colors.Green.Darken2 : Colors.Red.Darken2);
                            });

                            summary.Item().Text(txt =>
                            {
                                txt.Span("Rent income this month: ").SemiBold().FontSize(10);
                                txt.Span($"{rentForPeriod.ToString("F2", culture)} USD").FontSize(10);
                            });


                            // операции

                            summary.Item().Text("Operations this month").FontSize(12).SemiBold().Underline();

                            summary.Item().Text(txt =>
                            {
                                txt.Span("Deposits: ").SemiBold().FontSize(10);
                                txt.Span($"{totalDeposits.ToString("F2", culture)} USD").FontSize(10);
                            });

                            summary.Item().Text(txt =>
                            {
                                txt.Span("Withdrawals: ").SemiBold().FontSize(10);
                                txt.Span($"{totalWithdrawals.ToString("F2", culture)} USD").FontSize(10);
                            });

                            summary.Item().Text(txt =>
                            {
                                txt.Span("Investments (primary): ").SemiBold().FontSize(10);
                                txt.Span($"{totalInvestments.ToString("F2", culture)} USD").FontSize(10);
                            });

                            summary.Item().Text(txt =>
                            {
                                txt.Span("Share market BUY: ").SemiBold().FontSize(10);
                                txt.Span($"{totalShareBuys.ToString("F2", culture)} USD").FontSize(10);
                            });

                            summary.Item().Text(txt =>
                            {
                                txt.Span("Share market SELL: ").SemiBold().FontSize(10);
                                txt.Span($"{totalShareSells.ToString("F2", culture)} USD").FontSize(10);
                            });

                            summary.Item().Text(txt =>
                            {
                                txt.Span("Buyback operations: ").SemiBold().FontSize(10);
                                txt.Span($"{totalBuybacks.ToString("F2", culture)} USD").FontSize(10);
                            });

                            summary.Item().Text(txt =>
                            {
                                txt.Span("Rent income (transactions): ").SemiBold().FontSize(10);
                                txt.Span($"{totalRentIncomeOps.ToString("F2", culture)} USD").FontSize(10);
                            });

                            summary.Item().Text(txt =>
                            {
                                txt.Span("Net cashflow this month: ").SemiBold().FontSize(10)
                                   .FontColor(netCashflow >= 0 ? Colors.Green.Darken2 : Colors.Red.Darken2);
                                txt.Span($"{netCashflow.ToString("F2", culture)} USD").FontSize(10)
                                   .FontColor(netCashflow >= 0 ? Colors.Green.Darken2 : Colors.Red.Darken2);
                            });
                        });

                        // Holdings (портфель без картинок)
                        col.Item().PaddingBottom(10).Column(hold =>
                        {
                            hold.Item().Text("Holdings").FontSize(14).SemiBold().Underline();

                            if (holdings.Count == 0)
                            {
                                hold.Item().Text("No active holdings").FontSize(10).Italic();
                                return;
                            }

                            hold.Item().Table(table =>
                            {
                                table.ColumnsDefinition(cols =>
                                {
                                    // БЕЗ Photo:
                                    cols.RelativeColumn(3);    // Property
                                    cols.ConstantColumn(60);   // Shares
                                    cols.ConstantColumn(70);   // Cost/Share
                                    cols.ConstantColumn(70);   // Price/Share
                                    cols.ConstantColumn(80);   // Value
                                    cols.ConstantColumn(70);   // P&L
                                });

                                table.Header(header =>
                                {
                                    header.Cell().Element(HCell).Text("Property");
                                    header.Cell().Element(HCell).AlignRight().Text("Shares");
                                    header.Cell().Element(HCell).AlignRight().Text("Cost/Share");
                                    header.Cell().Element(HCell).AlignRight().Text("Price/Share");
                                    header.Cell().Element(HCell).AlignRight().Text("Value");
                                    header.Cell().Element(HCell).AlignRight().Text("P&L");

                                    static IContainer HCell(IContainer c) =>
                                        c.DefaultTextStyle(t => t.SemiBold())
                                         .Padding(3)
                                         .Background(Colors.Grey.Lighten3)
                                         .Border(0.5f)
                                         .BorderColor(Colors.Grey.Darken2);
                                });

                                foreach (var h in holdings)
                                {
                                    table.Cell().Element(BCell).Text(h.Title);
                                    table.Cell().Element(BCell).AlignRight().Text(h.Shares.ToString());
                                    table.Cell().Element(BCell).AlignRight().Text(h.CostPps.ToString("F2", culture));
                                    table.Cell().Element(BCell).AlignRight().Text(h.CurrentPps.ToString("F2", culture));
                                    table.Cell().Element(BCell).AlignRight().Text(h.MarketValue.ToString("F2", culture));

                                    var pnlColor = h.Gain >= 0 ? Colors.Green.Darken2 : Colors.Red.Darken2;
                                    table.Cell().Element(BCell).AlignRight()
                                         .Text(h.Gain.ToString("F2", culture))
                                         .FontColor(pnlColor);

                                    static IContainer BCell(IContainer c) =>
                                        c.Padding(3)
                                         .BorderBottom(0.25f)
                                         .BorderColor(Colors.Grey.Lighten2);
                                }
                            });
                        });

                        // --- Закомментированный вариант с колонкой Photo для будущих тестов ---
                        /*
                        col.Item().PaddingBottom(10).Column(holdWithImages =>
                        {
                            holdWithImages.Item().Text("Holdings (with photos)").FontSize(14).SemiBold().Underline();

                            holdWithImages.Item().Table(table =>
                            {
                                table.ColumnsDefinition(cols =>
                                {
                                    cols.ConstantColumn(60);   // Photo
                                    cols.RelativeColumn(3);    // Property
                                    cols.ConstantColumn(60);   // Shares
                                    cols.ConstantColumn(70);   // Cost/Share
                                    cols.ConstantColumn(70);   // Price/Share
                                    cols.ConstantColumn(80);   // Value
                                    cols.ConstantColumn(70);   // P&L
                                });

                                // header + rows см. старую реализацию с imageByProperty
                            });
                        });
                        */

                        // Переводим на новую страницу перед транзакциями
                        col.Item().PageBreak();

                        // Таблица транзакций
                        col.Item().PaddingBottom(5).Text("Transactions this month")
                            .FontSize(14)
                            .SemiBold()
                            .Underline();

                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(cols =>
                            {
                                cols.ConstantColumn(70);  // Date
                                cols.ConstantColumn(80);  // Type
                                cols.RelativeColumn(1);   // Property
                                cols.ConstantColumn(70);  // Amount
                                cols.ConstantColumn(50);  // Shares
                                cols.RelativeColumn(1);   // Notes
                            });

                            table.Header(header =>
                            {
                                header.Cell().Element(CellHeader).Text("Date");
                                header.Cell().Element(CellHeader).Text("Type");
                                header.Cell().Element(CellHeader).Text("Property");
                                header.Cell().Element(CellHeader).Text("Amount");
                                header.Cell().Element(CellHeader).Text("Shares");
                                header.Cell().Element(CellHeader).Text("Notes");

                                static IContainer CellHeader(IContainer container) =>
                                    container.DefaultTextStyle(t => t.SemiBold())
                                             .Padding(2)
                                             .Background(Colors.Grey.Lighten3)
                                             .Border(0.5f)
                                             .BorderColor(Colors.Grey.Darken2);
                            });

                            foreach (var t in txs)
                            {
                                table.Cell().Element(CellBody).Text(t.Timestamp.ToString("yyyy-MM-dd"));
                                table.Cell().Element(CellBody).Text(t.Type.ToString());
                                table.Cell().Element(CellBody).Text(t.PropertyTitle ?? "");
                                table.Cell().Element(CellBody).AlignRight().Text(t.Amount.ToString("F2", culture));
                                table.Cell().Element(CellBody).AlignRight().Text(t.Shares?.ToString() ?? "");
                                table.Cell().Element(CellBody).Text(t.Notes ?? "");

                                static IContainer CellBody(IContainer container) =>
                                    container.Padding(2)
                                             .BorderBottom(0.25f)
                                             .BorderColor(Colors.Grey.Lighten2);
                            }
                        });
                    });

                    page.Footer().AlignRight().Text(x =>
                    {
                        x.Span("Generated at ").FontSize(8);
                        x.Span($"{DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC").FontSize(8).Italic();
                    });
                });
            });

            return doc.GeneratePdf();
        }

        // служебная модель для «витрины активов»
        class HoldingRow
        {
            public Guid PropertyId { get; set; }
            public string Title { get; set; } = "";
            public int Shares { get; set; }
            public decimal CostPps { get; set; }
            public decimal CurrentPps { get; set; }
            public decimal MarketValue => Math.Round(CurrentPps * Shares, 2);
            public decimal Gain => Math.Round((CurrentPps - CostPps) * Shares, 2);
        }

        // безопасная декодировка base64 (с обрезкой data: префикса и ограничением размера)
        // сейчас НЕ используется, но оставляем для будущего, если вернём картинки
        static byte[]? SafeDecodeBase64(string base64)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(base64))
                    return null;

                var i = base64.IndexOf("base64,", StringComparison.OrdinalIgnoreCase);
                var pure = i >= 0 ? base64[(i + "base64,".Length)..] : base64;

                const int maxBase64Length = 700_000;
                if (pure.Length > maxBase64Length)
                    return null;

                return Convert.FromBase64String(pure);
            }
            catch
            {
                return null;
            }
        }
    }
}
