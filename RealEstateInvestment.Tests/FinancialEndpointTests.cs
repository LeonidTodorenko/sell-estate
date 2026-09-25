using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Models;
using Xunit;

namespace RealEstateInvestment.Tests;

public sealed class FinancialEndpointTests
{
    public static IEnumerable<object[]> ProtectedRoutes => new[]
    {
        "/api/investments/apply", "/api/investments/apply_old", "/api/applications/submit",
        "/api/share-offers", "/api/share-offers/sell-to-platform",
        "/api/share-offers/00000000-0000-0000-0000-000000000001/buy",
        "/api/share-offers/00000000-0000-0000-0000-000000000001/bid",
        "/api/share-offers/00000000-0000-0000-0000-000000000001/cancel",
        "/api/share-offers/00000000-0000-0000-0000-000000000001/extend-to",
        "/api/withdrawals/request", "/api/users/wallet/topup", "/api/demo/wallet/topup",
        "/api/withdrawals/00000000-0000-0000-0000-000000000001/approve",
        "/api/withdrawals/00000000-0000-0000-0000-000000000001/reject",
        "/api/properties/00000000-0000-0000-0000-000000000001/payment-plans"
    }.Select(x => new object[] { x });

    [Theory, MemberData(nameof(ProtectedRoutes))]
    public async Task Unauthenticated_financial_writes_return_401(string route)
    {
        using var h = new FinancialTestHost();
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.PostAsJsonAsync(route, new { })).StatusCode);
    }

    [Theory]
    [InlineData("1111", true)]
    [InlineData("plain-1111", true)]
    [InlineData("2222", false)]
    [InlineData("plain-2222", false)]
    public async Task Apply_ignores_body_actor_and_verifies_normal_actor_secret(string secret, bool valid)
    {
        using var h = new FinancialTestHost(); h.Login(h.Actor);
        var response = await h.Client.PostAsJsonAsync("/api/investments/apply", new
        { userId = h.Other, propertyId = h.PropertyId, requestedShares = 2, pinOrPassword = secret });
        Assert.Equal(valid ? HttpStatusCode.OK : HttpStatusCode.BadRequest, response.StatusCode);
        h.WithDb(db =>
        {
            Assert.Equal(valid ? 980 : 1000, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(1000, db.Users.Find(h.Other)!.WalletBalance);
            Assert.Equal(valid ? 78 : 80, db.Properties.Find(h.PropertyId)!.AvailableShares);
            Assert.All(db.InvestmentApplications, a => Assert.Equal(h.Actor, a.UserId));
        });
    }

    [Fact]
    public async Task Withdrawal_ignores_actor_id_and_resets_client_workflow_fields()
    {
        using var h = new FinancialTestHost(); h.Login(h.Actor);
        var suppliedId = Guid.NewGuid();
        var result = await h.Client.PostAsJsonAsync("/api/withdrawals/request", new
        { id = suppliedId, userId = h.Other, amount = 40m, status = "approved", createdAt = DateTime.UtcNow.AddYears(-10) });
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        h.WithDb(db =>
        {
            var withdrawal = db.WithdrawalRequests.Single();
            Assert.Equal(h.Actor, withdrawal.UserId); Assert.NotEqual(suppliedId, withdrawal.Id);
            Assert.Equal("pending", withdrawal.Status); Assert.True(withdrawal.CreatedAt > DateTime.UtcNow.AddMinutes(-1));
            Assert.Equal(960, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(1000, db.Users.Find(h.Other)!.WalletBalance);
            Assert.Equal(h.Actor, db.UserTransactions.Single().UserId);
        });
    }

    [Theory]
    [InlineData("reject", "reject", 1000)]
    [InlineData("approve", "reject", 960)]
    [InlineData("reject", "approve", 1000)]
    [InlineData("approve", "approve", 960)]
    public async Task Withdrawal_terminal_transition_happens_once(string first, string second, int balance)
    {
        using var h = new FinancialTestHost(); h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync("/api/withdrawals/request", new { userId = h.Other, amount = 40m })).StatusCode);
        Guid id = default; h.WithDb(db => id = db.WithdrawalRequests.Single().Id);
        h.Login(h.Admin, role: "admin");
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync($"/api/withdrawals/{id}/{first}", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PostAsJsonAsync($"/api/withdrawals/{id}/{second}", new { })).StatusCode);
        h.WithDb(db =>
        {
            Assert.Equal(balance, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(2, db.UserTransactions.Count());
            Assert.Equal(2, db.ActionLogs.Count());
            Assert.Equal(first == "approve" ? "approved" : "rejected", db.WithdrawalRequests.Single().Status);
        });
    }

    [Theory]
    [InlineData("cancel")]
    [InlineData("extend-to")]
    public async Task Offer_operations_require_owner_even_with_owners_PIN(string action)
    {
        using var h = new FinancialTestHost(); h.Login(h.Actor);
        var payload = new { userId = h.Other, pinOrPassword = "2222", newDate = DateTime.UtcNow.AddDays(4) };
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync($"/api/share-offers/{h.Offer}/{action}", payload)).StatusCode);
        h.Login(h.Other);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync($"/api/share-offers/{h.Offer}/{action}", payload)).StatusCode);
        if (action == "cancel")
        {
            Assert.Equal(HttpStatusCode.NotFound, (await h.Client.PostAsJsonAsync($"/api/share-offers/{h.Offer}/cancel", payload)).StatusCode);
            h.WithDb(db =>
            {
                Assert.Equal(2, db.Investments.Where(i => i.UserId == h.Other).Sum(i => i.Shares));
                Assert.Equal(h.Other, db.ActionLogs.Single().UserId);
            });
        }
    }

    [Theory]
    [InlineData("create")]
    [InlineData("buy")]
    [InlineData("bid")]
    [InlineData("buyback")]
    public async Task Marketplace_uses_JWT_actor_instead_of_all_body_ids(string action)
    {
        using var h = new FinancialTestHost(); h.Login(h.Actor);
        var (route, payload) = MarketRequest(h, action, "1111");
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync(route, payload)).StatusCode);
        h.WithDb(db =>
        {
            if (action == "create") Assert.Equal(h.Actor, db.ShareOffers.Single(o => o.Id != h.Offer).SellerId);
            if (action == "bid") Assert.Equal(h.Actor, db.ShareOfferBids.Single().BidderId);
            if (action == "buy")
            {
                Assert.Equal(980, db.Users.Find(h.Actor)!.WalletBalance);
                Assert.Equal(12, db.Investments.Where(i => i.UserId == h.Actor).Sum(i => i.Shares));
                Assert.False(db.ShareOffers.Find(h.Offer)!.IsActive);
            }
            if (action == "buyback")
            {
                Assert.Equal(1100, db.Users.Find(h.Actor)!.WalletBalance);
                Assert.Equal(1000, db.Users.Find(h.Other)!.WalletBalance);
                Assert.Empty(db.Investments.Where(i => i.UserId == h.Actor));
            }
        });
    }

    [Theory]
    [InlineData("create")]
    [InlineData("buy")]
    [InlineData("bid")]
    [InlineData("buyback")]
    public async Task Marketplace_rejects_other_users_PIN(string action)
    {
        using var h = new FinancialTestHost(); h.Login(h.Actor);
        var (route, payload) = MarketRequest(h, action, "2222");
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync(route, payload)).StatusCode);
        h.WithDb(db => { Assert.Equal(1000, db.Users.Find(h.Actor)!.WalletBalance); Assert.Empty(db.UserTransactions); });
    }

    private static (string, object) MarketRequest(FinancialTestHost h, string action, string pin) => action switch
    {
        "create" => ("/api/share-offers", new { sellerId = h.Other, propertyId = h.PropertyId, sharesForSale = 2,
            startPricePerShare = 10m, expirationDate = DateTime.UtcNow.AddDays(1), pinOrPassword = pin }),
        "buy" => ($"/api/share-offers/{h.Offer}/buy", new { buyerId = h.Other, sharesToBuy = 2, pinOrPassword = pin }),
        "bid" => ($"/api/share-offers/{h.Offer}/bid", new { bidderId = h.Other, shares = 1, bidPricePerShare = 10m, pinOrPassword = pin }),
        _ => ("/api/share-offers/sell-to-platform", new { userId = h.Other, propertyId = h.PropertyId, pinOrPassword = pin })
    };

    public static IEnumerable<object[]> RevokedDemoCases =>
        from state in new[] { "blocked", "deleted", "expired", "inactive", "template", "missing" }
        from route in new[] { "apply", "create", "buy", "bid", "cancel", "extend-to", "withdraw", "topup", "buyback" }
        select new object[] { state, route };

    [Theory, MemberData(nameof(RevokedDemoCases))]
    public async Task Every_demo_financial_write_rejects_revoked_actor(string state, string action)
    {
        using var h = new FinancialTestHost();
        h.WithDb(db =>
        {
            var demo = db.DemoUsers.Find(h.Demo)!;
            if (state == "blocked") demo.IsBlocked = true;
            if (state == "deleted") demo.IsDeleted = true;
            if (state == "expired") demo.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            if (state == "inactive") demo.IsActive = false;
            if (state == "template") demo.IsTemplate = true;
            db.SaveChanges();
        });
        h.Login(state == "missing" ? Guid.NewGuid() : h.Demo, demo: true);
        var route = action switch
        {
            "apply" => "/api/investments/apply", "create" => "/api/share-offers",
            "withdraw" => "/api/withdrawals/request", "topup" => "/api/demo/wallet/topup",
            "buyback" => "/api/share-offers/sell-to-platform", _ => $"/api/share-offers/{h.DemoOffer}/{action}"
        };
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.PostAsJsonAsync(route,
            new { userId = h.DemoOther, amount = 1m, pinOrPassword = "4444", propertyId = h.PropertyId, requestedShares = 1 })).StatusCode);
        h.WithDb(db => { Assert.Equal(1000, db.DemoUsers.Find(h.Demo)!.WalletBalance); Assert.Empty(db.DemoUserTransactions); });
    }

    [Theory]
    [InlineData(1, HttpStatusCode.OK)]
    [InlineData(100000, HttpStatusCode.OK)]
    [InlineData(0, HttpStatusCode.BadRequest)]
    [InlineData(-1, HttpStatusCode.BadRequest)]
    [InlineData(100001, HttpStatusCode.BadRequest)]
    public async Task Demo_topup_validates_amount_and_only_changes_demo_tables(int amount, HttpStatusCode expected)
    {
        using var h = new FinancialTestHost(); h.Login(h.Demo, demo: true);
        h.WithDb(db => { db.DemoUsers.Find(h.Demo)!.ExpiresAt = null; db.SaveChanges(); });
        Assert.Equal(expected, (await h.Client.PostAsJsonAsync("/api/demo/wallet/topup", new { userId = h.Other, amount })).StatusCode);
        h.WithDb(db =>
        {
            Assert.Equal(expected == HttpStatusCode.OK ? 1000 + amount : 1000, db.DemoUsers.Find(h.Demo)!.WalletBalance);
            Assert.Equal(1000, db.DemoUsers.Find(h.DemoOther)!.WalletBalance);
            Assert.All(db.Users, u => Assert.Equal(1000, u.WalletBalance));
            Assert.Empty(db.UserTransactions); Assert.Empty(db.ActionLogs);
            Assert.Equal(expected == HttpStatusCode.OK ? 1 : 0, db.DemoUserTransactions.Count());
        });
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Production_topup_is_unavailable_even_with_valid_secret(bool admin)
    {
        using var h = new FinancialTestHost(); h.Login(admin ? h.Admin : h.Actor, role: admin ? "admin" : "investor");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await h.Client.PostAsJsonAsync("/api/users/wallet/topup",
            new { userId = h.Other, amount = 1000m, pinOrPassword = "2222" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync("/api/demo/wallet/topup", new { amount = 1m })).StatusCode);
        h.WithDb(db => { Assert.All(db.Users, u => Assert.Equal(1000, u.WalletBalance)); Assert.Empty(db.UserTransactions); });
    }

    [Theory]
    [InlineData("4444")]
    [InlineData("demo-4444")]
    public async Task Demo_apply_accepts_PIN_or_hashed_password_and_isolated_accounting(string secret)
    {
        using var h = new FinancialTestHost(); h.Login(h.Demo, demo: true);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync("/api/investments/apply", new
        { userId = h.Actor, propertyId = h.PropertyId, requestedShares = 1, pinOrPassword = secret })).StatusCode);
        h.WithDb(db =>
        {
            Assert.Equal(990, db.DemoUsers.Find(h.Demo)!.WalletBalance);
            Assert.Equal(h.Demo, db.DemoInvestmentApplications.Single().DemoUserId);
            Assert.Equal(80, db.Properties.Find(h.PropertyId)!.AvailableShares);
            Assert.All(db.Users, u => Assert.Equal(1000, u.WalletBalance));
            Assert.Empty(db.InvestmentApplications); Assert.Empty(db.UserTransactions);
        });
    }

    [Fact]
    public async Task Demo_withdrawal_is_instant_and_does_not_enter_production_queue()
    {
        using var h = new FinancialTestHost(); h.Login(h.Demo, demo: true);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync("/api/withdrawals/request", new { userId = h.Actor, amount = 10m })).StatusCode);
        h.WithDb(db =>
        {
            Assert.Equal(990, db.DemoUsers.Find(h.Demo)!.WalletBalance);
            Assert.Empty(db.WithdrawalRequests); Assert.Empty(db.UserTransactions);
            Assert.Equal(h.Demo, db.DemoUserTransactions.Single().DemoUserId);
        });
    }

    public static IEnumerable<object[]> AdminRoutes => new[]
    {
        "/api/withdrawals/{id}/approve", "/api/withdrawals/{id}/reject",
        "/api/investments/finalize/{id}", "/api/investments/validate-payments/{id}",
        "/api/investments/{id}/kyc/verify", "/api/investments/{id}/kyc/reject",
        "/api/kyc/{id}/approve", "/api/kyc/{id}/reject", "/api/kyc/admin-upload",
        "/api/users/{id}/verify-kyc", "/api/users/{id}/change-role", "/api/users/{id}/unblock",
        "/api/applications/{id}/approve", "/api/applications/{id}/reject",
        "/api/properties/{id}/validate-payments", "/api/properties/{id}/pay-rent",
        "/api/properties/{id}/payment-plans", "/api/rentals/payout/{id}",
        "/api/admin/investments/{id}/approve", "/api/admin/investments/{id}/reject",
        "/api/admin/users/{id}/reset-pin", "/api/admin/users/{id}/reset-password", "/api/admin/users/{id}/force-confirm-email"
    }.Select(x => new object[] { x });

    [Theory, MemberData(nameof(AdminRoutes))]
    public async Task Investors_cannot_invoke_financial_admin_actions(string route)
    {
        using var h = new FinancialTestHost(); h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync(route.Replace("{id}", h.PropertyId.ToString()), new { })).StatusCode);
    }

    [Theory]
    [InlineData("demo")]
    [InlineData("blocked")]
    [InlineData("deleted")]
    [InlineData("revoked-role")]
    public async Task Admin_claim_alone_does_not_bypass_current_account_or_demo_boundary(string state)
    {
        using var h = new FinancialTestHost();
        h.WithDb(db =>
        {
            var a = db.Users.Find(h.Admin)!;
            if (state == "blocked") a.IsBlocked = true;
            if (state == "deleted") a.IsDeleted = true;
            if (state == "revoked-role") a.Role = "investor"; // Legacy change-role does not synchronize UserRole.
            db.SaveChanges();
        });
        h.Login(state == "demo" ? h.Demo : h.Admin, demo: state == "demo", role: "admin");
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync($"/api/withdrawals/{Guid.NewGuid()}/reject", new { })).StatusCode);
    }

    [Theory]
    [InlineData("blocked")]
    [InlineData("deleted")]
    [InlineData("unconfirmed")]
    public async Task Normal_revocation_rejects_financial_write(string state)
    {
        using var h = new FinancialTestHost(); h.Login(h.Actor);
        h.WithDb(db =>
        {
            var a = db.Users.Find(h.Actor)!;
            a.IsBlocked = state == "blocked"; a.IsDeleted = state == "deleted";
            a.IsEmailConfirmed = state != "unconfirmed"; db.SaveChanges();
        });
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync("/api/withdrawals/request", new { amount = 1 })).StatusCode);
    }

    [Fact]
    public async Task Malformed_JWT_actor_is_unauthorized()
    {
        using var h = new FinancialTestHost(); h.Login(h.Actor, identity: "not-a-guid");
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.PostAsJsonAsync("/api/withdrawals/request", new { amount = 1 })).StatusCode);
    }

    [Theory]
    [InlineData("apply_old")]
    [InlineData("submit")]
    public async Task Unused_unsafe_submission_routes_are_retired(string action)
    {
        using var h = new FinancialTestHost(); h.Login(h.Actor);
        var route = action == "submit" ? "/api/applications/submit" : "/api/investments/apply_old";
        // apply_old inherits persistence navigation fields: include them to pass its unchanged DTO validation.
        var payload = new { userId = h.Other, propertyId = h.PropertyId, pinOrPassword = "1111",
            user = new { fullName = "x", email = "x@example.invalid", passwordHash = "x", secretWord = "x", clientNumber = "x" },
            property = new { title = "x", location = "x" } };
        Assert.Equal(HttpStatusCode.Gone, (await h.Client.PostAsJsonAsync(route, payload)).StatusCode);
        h.WithDb(db => Assert.All(db.Users, u => Assert.Equal(1000, u.WalletBalance)));
    }

    [Theory]
    [InlineData("create")]
    [InlineData("buy")]
    [InlineData("bid")]
    [InlineData("cancel")]
    [InlineData("extend-to")]
    public async Task Demo_marketplace_valid_writes_use_demo_JWT_and_preserve_production(string action)
    {
        using var h = new FinancialTestHost();
        var ownerAction = action is "cancel" or "extend-to";
        h.Login(ownerAction ? h.DemoOther : h.Demo, demo: true);
        var secret = ownerAction ? "demo-5555" : "demo-4444";
        object payload = action switch
        {
            "create" => new { sellerId = h.Actor, propertyId = h.PropertyId, sharesForSale = 2,
                startPricePerShare = 10m, expirationDate = DateTime.UtcNow.AddDays(1), pinOrPassword = secret },
            "buy" => new { buyerId = h.Other, sharesToBuy = 2, pinOrPassword = secret },
            "bid" => new { bidderId = h.Other, shares = 1, bidPricePerShare = 10m, pinOrPassword = secret },
            _ => new { userId = h.Other, pinOrPassword = secret, newDate = DateTime.UtcNow.AddDays(4) }
        };
        var route = action == "create" ? "/api/share-offers" : $"/api/share-offers/{h.DemoOffer}/{action}";
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync(route, payload)).StatusCode);
        h.WithDb(db =>
        {
            Assert.All(db.Users, u => Assert.Equal(1000, u.WalletBalance));
            Assert.Equal(80, db.Properties.Find(h.PropertyId)!.AvailableShares);
            Assert.Equal(10, db.Investments.Single().Shares);
            Assert.True(db.ShareOffers.Single().IsActive);
            Assert.Empty(db.ShareOfferBids); Assert.Empty(db.UserTransactions); Assert.Empty(db.ActionLogs);
            if (action == "create") Assert.Equal(h.Demo, db.DemoShareOffers.Single(o => o.Id != h.DemoOffer).DemoSellerId);
            if (action == "bid") Assert.Equal(h.Demo, db.DemoShareOfferBids.Single().DemoBidderId);
            if (action == "buy") Assert.Equal(980, db.DemoUsers.Find(h.Demo)!.WalletBalance);
            if (action == "cancel") Assert.Equal(2, db.DemoInvestments.Single(i => i.DemoUserId == h.DemoOther).Shares);
        });
    }

    [Theory]
    [InlineData("cancel")]
    [InlineData("extend-to")]
    public async Task Demo_nonowner_cannot_use_sellers_secret(string action)
    {
        using var h = new FinancialTestHost(); h.Login(h.Demo, demo: true);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.PostAsJsonAsync($"/api/share-offers/{h.DemoOffer}/{action}",
            new { pinOrPassword = "5555", newDate = DateTime.UtcNow.AddDays(4) })).StatusCode);
    }

    [Fact]
    public async Task Demo_hash_itself_is_not_a_password_and_buyback_remains_disabled()
    {
        using var h = new FinancialTestHost(); h.Login(h.Demo, demo: true);
        string hash = ""; h.WithDb(db => hash = db.DemoUsers.Find(h.Demo)!.PasswordHash);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/investments/apply", new
        { propertyId = h.PropertyId, requestedShares = 1, pinOrPassword = hash })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/share-offers/sell-to-platform", new
        { propertyId = h.PropertyId, pinOrPassword = "4444" })).StatusCode);
        h.WithDb(db => { Assert.Equal(1000, db.DemoUsers.Find(h.Demo)!.WalletBalance); Assert.Empty(db.UserTransactions); });
    }

    [Theory]
    [InlineData("approve", "approve")]
    [InlineData("approve", "reject")]
    [InlineData("reject", "approve")]
    [InlineData("carry", "carry")]
    public async Task Legacy_admin_application_transitions_are_gone_without_mutation(string first, string second)
    {
        using var h = new FinancialTestHost(); h.Login(h.Admin, role: "admin");
        var id = Guid.NewGuid();
        h.WithDb(db =>
        {
            db.InvestmentApplications.Add(new InvestmentApplication
            { Id = id, UserId = h.Actor, PropertyId = h.PropertyId, RequestedShares = 1, RequestedAmount = 10 });
            db.SaveChanges();
        });
        Assert.Equal(HttpStatusCode.Gone, (await h.Client.PostAsJsonAsync($"/api/applications/{id}/{first}", 1)).StatusCode);
        Assert.Equal(HttpStatusCode.Gone, (await h.Client.PostAsJsonAsync($"/api/applications/{id}/{second}", 1)).StatusCode);
        h.WithDb(db =>
        {
            Assert.Equal(1000, db.Users.Find(h.Actor)!.WalletBalance);
            Assert.Equal(80, db.Properties.Find(h.PropertyId)!.AvailableShares);
            var app = db.InvestmentApplications.Single();
            Assert.Equal("pending", app.Status); Assert.Equal(1, app.StepNumber);
            Assert.Null(app.ApprovedAmount); Assert.Null(app.ApprovedShares);
            Assert.Single(db.Investments); Assert.Empty(db.Messages); Assert.Empty(db.ActionLogs);
            Assert.Equal(0, db.PaymentPlans.Single().Paid);
        });
    }

    [Fact]
    public async Task Buyout_cannot_sell_a_completed_lot_twice()
    {
        using var h = new FinancialTestHost(); h.Login(h.Actor);
        var (route, payload) = MarketRequest(h, "buy", "1111");
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync(route, payload)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.PostAsJsonAsync(route, payload)).StatusCode);
        h.WithDb(db => Assert.Equal(980, db.Users.Find(h.Actor)!.WalletBalance));
    }

    [Fact]
    public async Task Kyc_upload_cannot_impersonate_or_self_approve_and_nonowner_cannot_delete()
    {
        using var h = new FinancialTestHost(); h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync("/api/kyc/upload", new
        { userId = h.Other, base64File = "test-only", status = "approved" })).StatusCode);
        Guid id = default;
        h.WithDb(db =>
        {
            var doc = db.KycDocuments.Single(); id = doc.Id;
            Assert.Equal(h.Actor, doc.UserId); Assert.Equal("pending", doc.Status);
        });
        h.Login(h.Other);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync($"/api/kyc/{id}/delete", new { })).StatusCode);
        h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync($"/api/kyc/{id}/delete", new { })).StatusCode);
    }

    [Fact]
    public async Task Manual_rent_payout_cannot_be_repeated_inside_existing_30_day_window()
    {
        using var h = new FinancialTestHost(); h.Login(h.Admin, role: "admin");
        var route = $"/api/properties/{h.PropertyId}/pay-rent";
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync(route, new { customAmount = 100m })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PostAsJsonAsync(route, new { customAmount = 100m })).StatusCode);
        h.WithDb(db => { Assert.Equal(1010, db.Users.Find(h.Actor)!.WalletBalance); Assert.Single(db.UserTransactions); });
    }
}
