using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;
using Xunit;

namespace RealEstateInvestment.Tests;

public sealed class DemoRentalPresentationTests
{
    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public async Task Fund_one_share_per_synthetic_demo_account_and_preserve_wallets(int recipients)
    {
        using var host = new FinancialTestHost();
        var apartmentId = new Guid("755df843-3cad-46eb-86da-c3078288cb71");
        host.WithDb(db =>
        {
            var now = DateTime.UtcNow;
            db.Properties.Add(new Property
            {
                Id = apartmentId, Title = "Marina Rental Residence — Demo", Location = "Illustrative location",
                About = "Fictional apartment for a demo rental scenario.", Price = 100_000m,
                TotalShares = 100, AvailableShares = 100, Status = "available",
                MonthlyRentalIncome = 1000m, LastPayoutDate = now.AddDays(-40),
                PaymentPlans =
                [
                    new()
                    {
                        PropertyId = apartmentId, Milestone = "Simulated completed funding",
                        Total = 100_000m, Paid = 100_000m, AmountDue = 100_000m,
                        EventDate = now.AddDays(-60), DueDate = now.AddDays(-40)
                    }
                ]
            });
            db.SaveChanges();
        });

        var testers = new[] { (host.Demo, "4444"), (host.DemoOther, "5555") }.Take(recipients).ToArray();
        foreach (var (account, pin) in testers)
        {
            host.Login(account, demo: true);
            Assert.Equal(HttpStatusCode.OK, (await host.Client.PostAsJsonAsync(
                "/api/demo/wallet/topup", new { amount = 1000m })).StatusCode);
            var operationId = Guid.NewGuid();
            for (var attempt = 0; attempt < 2; attempt++)
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, "/api/investments/apply")
                {
                    Content = JsonContent.Create(new { propertyId = apartmentId, requestedShares = 1, pinOrPassword = pin })
                };
                request.Headers.Add("Idempotency-Key", operationId.ToString());
                Assert.Equal(HttpStatusCode.OK, (await host.Client.SendAsync(request)).StatusCode);
            }
        }

        host.WithDb(db =>
        {
            var property = db.Properties.Include(item => item.PaymentPlans).Single(item => item.Id == apartmentId);
            property.Status = "rented";
            db.SaveChanges();

            var positions = db.DemoInvestments.Where(item => item.PropertyId == apartmentId).ToList();
            Assert.Equal(testers.Select(tester => tester.Item1).Order(), positions.Select(item => item.DemoUserId).Order());
            Assert.All(positions, item =>
            {
                Assert.Equal(1, item.Shares);
                Assert.Equal(1000m, item.InvestedAmount);
                Assert.Equal(1000m, db.DemoUsers.Find(item.DemoUserId)!.WalletBalance);
            });
            Assert.Equal(100 - recipients, property.TotalShares - positions.Sum(item => item.Shares));
            Assert.Equal(10m, property.MonthlyRentalIncome / property.TotalShares);
            Assert.Equal(0m, Assert.Single(property.PaymentPlans!).Outstanding);
            var journal = db.DemoUserTransactions.ToList();
            Assert.Equal(2 * recipients, journal.Count);
            Assert.Equal(1000m * recipients, journal.Where(item => item.Type == TransactionType.Deposit).Sum(item => item.Amount));
            Assert.Equal(1000m * recipients, journal.Where(item => item.Type == TransactionType.Investment).Sum(item => item.Amount));
            Assert.Equal(2 * recipients, db.DemoActionLogs.Count());
            Assert.Empty(db.DemoInvestmentApplications);
            Assert.Empty(db.Investments.Where(item => item.PropertyId == apartmentId));
            Assert.Empty(db.UserTransactions);
            Assert.Equal(1000m, db.Users.Find(host.Actor)!.WalletBalance);
        });
    }
}
