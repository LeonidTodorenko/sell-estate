using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateInvestment.Controllers;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;
using Xunit;

namespace RealEstateInvestment.Tests;

public sealed class AuthorizationExposureTests
{
    private static FinancialTestHost Host() => new(services =>
    {
        services.AddTransient<AdminController>(sp => new AdminController(
            sp.GetRequiredService<AppDbContext>(), sp.GetRequiredService<IConfiguration>(), null!));
        services.AddTransient<AdminStatsController>(sp => new AdminStatsController(
            sp.GetRequiredService<RealEstateInvestment.Services.ISuperUserService>(), sp.GetRequiredService<AppDbContext>(), null!, null!));
        services.AddTransient<AdminFinanceController>(sp => new AdminFinanceController(null!, sp.GetRequiredService<AppDbContext>()));
        services.AddTransient<AdminUsersController>(sp => new AdminUsersController(sp.GetRequiredService<AppDbContext>(), null!));
        services.AddTransient<AdminDemoAccountsController>(sp => new AdminDemoAccountsController(
            sp.GetRequiredService<AppDbContext>(), sp.GetRequiredService<IConfiguration>(), null!));
        services.AddTransient<ModerationController>(sp => new ModerationController(sp.GetRequiredService<AppDbContext>(), null!));
    });

    public static IEnumerable<object[]> PrivateRoutes => new[]
    {
        "/api/applications/user/{0}", "/api/users/{0}", "/api/users/{0}/total-assets",
        "/api/users/{0}/assets-summary", "/api/users/transactions/user/{0}",
        "/api/investments/user/{0}", "/api/investments/with-aggregated/{0}", "/api/investments/with-details/{0}",
        "/api/kyc/user/{0}", "/api/withdrawals/user/{0}", "/api/rentals/investor/{0}",
        "/api/share-offers/user/{0}/grouped", "/api/share-offers/user/{0}/active",
        "/api/share-offers/user/{0}/with-property", "/api/share-offers/{0}/club-info",
        "/api/messages/inbox/{0}", "/api/messages/unread-count/{0}",
        "/api/chat/dialog/{0}", "/api/chat/my-messages/{0}", "/api/notifications/{0}",
        "/api/properties/my-properties/{0}"
    }.Select(x => new object[] { x });

    [Theory, MemberData(nameof(PrivateRoutes))]
    public async Task Private_routes_reject_anonymous_other_owner_and_cross_boundary_targets(string route)
    {
        using var h = Host();
        var other = string.Format(route, h.Other);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync(other)).StatusCode);
        h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync(other)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync(string.Format(route, h.Demo))).StatusCode);
        h.Login(h.Demo, demo: true);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync(other)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync(string.Format(route, h.DemoOther))).StatusCode);
    }

    [Fact]
    public async Task Applications_return_only_owner_rows_and_admin_can_read_production_owner()
    {
        using var h = Host();
        var a = Guid.NewGuid(); var b = Guid.NewGuid(); var d = Guid.NewGuid();
        h.WithDb(db =>
        {
            db.InvestmentApplications.AddRange(
                new InvestmentApplication { Id = a, UserId = h.Actor, PropertyId = h.PropertyId, RequestedShares = 1 },
                new InvestmentApplication { Id = b, UserId = h.Other, PropertyId = h.PropertyId, RequestedShares = 2 });
            db.DemoInvestmentApplications.Add(new DemoInvestmentApplication
                { Id = d, DemoUserId = h.Demo, PropertyId = h.PropertyId, RequestedShares = 3 });
            db.SaveChanges();
        });
        h.Login(h.Actor);
        var json = await GetJson(h, $"/api/applications/user/{h.Actor}");
        Assert.Contains(a.ToString(), json); Assert.DoesNotContain(b.ToString(), json);
        h.Login(h.Demo, demo: true);
        json = await GetJson(h, $"/api/applications/user/{h.Demo}");
        Assert.Contains(d.ToString(), json); Assert.DoesNotContain(a.ToString(), json);
        h.Login(h.Admin, role: "admin");
        Assert.Contains(b.ToString(), await GetJson(h, $"/api/applications/user/{h.Other}"));
    }

    [Theory]
    [InlineData("/api/users/{0}")]
    [InlineData("/api/auth/me")]
    [InlineData("/api/applications/user/{0}")]
    [InlineData("/api/investments/user/{0}")]
    [InlineData("/api/kyc/user/{0}")]
    [InlineData("/api/withdrawals/user/{0}")]
    [InlineData("/api/rentals/investor/{0}")]
    [InlineData("/api/users/transactions/user/{0}")]
    [InlineData("/api/messages/inbox/{0}")]
    [InlineData("/api/chat/dialog/{0}")]
    [InlineData("/api/chat/my-messages/{0}")]
    [InlineData("/api/notifications/{0}")]
    public async Task Demo_with_same_UUID_as_production_cannot_read_production_rows(string route)
    {
        using var h = Host();
        const string marker = "PRODUCTION-PRIVATE-MARKER";
        h.WithDb(db =>
        {
            db.DemoUsers.Add(new DemoUser { Id = h.Actor, DemoCode = "collision", Email = "demo-collision@example.invalid",
                FullName = "Sandbox", ClientNumber = "collision", PasswordHash = "demo-secret" });
            db.Users.Find(h.Actor)!.FullName = marker;
            db.InvestmentApplications.Add(new InvestmentApplication { UserId = h.Actor, PropertyId = h.PropertyId, Status = marker });
            db.KycDocuments.Add(new KycDocument { UserId = h.Actor, Base64File = marker });
            db.WithdrawalRequests.Add(new WithdrawalRequest { UserId = h.Actor, Status = marker });
            db.UserTransactions.Add(new UserTransaction { UserId = h.Actor, Notes = marker, PropertyTitle = marker });
            db.Messages.Add(new Message { RecipientId = h.Actor, Title = marker, Content = marker });
            db.ChatMessages.Add(new ChatMessage { SenderId = h.Admin, RecipientId = h.Actor, Content = marker });
            db.Notifications.Add(new Notification { UserId = h.Actor, Message = marker });
            db.SaveChanges();
        });
        h.Login(h.Actor, demo: true);
        var json = await GetJson(h, string.Format(route, h.Actor));
        Assert.DoesNotContain(marker, json);
        if (route.Contains("/investments/")) Assert.Equal("[]", json);
        AssertNoSecrets(json);
    }

    public static IEnumerable<object[]> AdminRoutes => new[]
    {
        "/api/users", "/api/users/all", "/api/investments/all", "/api/investments/kyc/pending",
        "/api/admin/users", "/api/admin/investments", "/api/admin/demo-accounts",
        "/api/admin/finance/period/2026-09", "/api/admin/stats/logs", "/api/moderation/requests",
        "/api/chat/conversations", "/api/properties/debug-files", "/api/properties/debug-files2"
    }.Select(x => new object[] { x });

    [Theory, MemberData(nameof(AdminRoutes))]
    public async Task Sensitive_admin_routes_check_current_production_admin(string route)
    {
        using var h = Host();
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync(route)).StatusCode);
        h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync(route)).StatusCode);
        h.Login(h.Demo, demo: true, role: "admin");
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync(route)).StatusCode);
        // Production UUID with a demo JWT must not use the production admin account.
        h.Login(h.Admin, demo: true, role: "admin");
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync(route)).StatusCode);
        h.Login(h.Admin, role: "admin");
        h.WithDb(db => { db.Users.Find(h.Admin)!.IsBlocked = true; db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync(route)).StatusCode);
        h.WithDb(db => { var u = db.Users.Find(h.Admin)!; u.IsBlocked = false; u.Role = "investor"; u.UserRole = UserRole.Investor; db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync(route)).StatusCode);
        h.WithDb(db => { var u = db.Users.Find(h.Admin)!; u.Role = "admin"; u.IsDeleted = true; db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync(route)).StatusCode);
    }

    [Fact]
    public async Task Owner_and_admin_responses_do_not_serialize_credentials_or_navigation_entities()
    {
        using var h = Host(); h.Login(h.Actor);
        foreach (var route in new[] { $"/api/users/{h.Actor}", "/api/auth/me", $"/api/investments/user/{h.Actor}" })
            AssertNoSecrets(await GetJson(h, route));
        h.Login(h.Demo, demo: true);
        AssertNoSecrets(await GetJson(h, $"/api/users/{h.Demo}"));
        AssertNoSecrets(await GetJson(h, "/api/auth/me"));
        h.Login(h.Admin, role: "admin");
        foreach (var route in new[] { "/api/users", "/api/users/all", "/api/investments/kyc/pending",
            "/api/admin/users", "/api/admin/demo-accounts", "/api/admin/investments", "/api/chat/conversations", $"/api/users/{h.Other}" })
            AssertNoSecrets(await GetJson(h, route));
    }

    [Theory]
    [InlineData("update-profile")]
    [InlineData("change-password")]
    [InlineData("upload-avatar")]
    public async Task Profile_mutations_cannot_target_other_users_in_either_boundary(string action)
    {
        using var h = Host();
        var body = new { fullName = "Changed", currentPassword = "plain-2222", newPassword = "new-secret", base64Image = "new-avatar" };
        h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync($"/api/users/{h.Other}/{action}", body)).StatusCode);
        h.Login(h.Demo, demo: true);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync($"/api/users/{h.Other}/{action}", body)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync($"/api/users/{h.DemoOther}/{action}", body)).StatusCode);
        h.Login(h.Other);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync($"/api/users/{h.Other}/{action}", body)).StatusCode);
    }

    [Fact]
    public async Task Inbox_notification_and_chat_enforce_record_ownership()
    {
        using var h = Host(); var message = Guid.NewGuid(); var notification = Guid.NewGuid();
        h.WithDb(db =>
        {
            db.Messages.Add(new Message { Id = message, RecipientId = h.Other, Title = "Private", Content = "PRIVATE-CHAT" });
            db.Notifications.Add(new Notification { Id = notification, UserId = h.Other, Message = "Private" });
            db.ChatMessages.Add(new ChatMessage { SenderId = h.Admin, RecipientId = h.Other, Content = "PRIVATE-CHAT" });
            db.SaveChanges();
        });
        h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.PostAsJsonAsync($"/api/messages/{message}/mark-read", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.PostAsJsonAsync($"/api/notifications/{notification}/read", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync($"/api/chat/conversation/{h.Admin}/{h.Other}")).StatusCode);
        h.Login(h.Other);
        Assert.Contains("PRIVATE-CHAT", await GetJson(h, $"/api/chat/conversation/{h.Admin}/{h.Other}"));
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync($"/api/messages/{message}/mark-read", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync($"/api/notifications/{notification}/read", new { })).StatusCode);
        h.WithDb(db => { Assert.True(db.Messages.Find(message)!.IsRead); Assert.True(db.Notifications.Find(notification)!.IsRead); });
    }

    [Fact]
    public async Task Revoked_admin_cannot_use_owner_read_or_KYC_delete_override()
    {
        using var h = Host(); var doc = Guid.NewGuid();
        h.WithDb(db => { db.KycDocuments.Add(new KycDocument { Id = doc, UserId = h.Other, Base64File = "private" });
            db.Users.Find(h.Admin)!.Role = "investor"; db.SaveChanges(); });
        h.Login(h.Admin, role: "admin");
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync($"/api/applications/user/{h.Other}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync($"/api/chat/conversation/{h.Actor}/{h.Other}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync($"/api/kyc/{doc}/delete", new { })).StatusCode);
        h.WithDb(db => { db.Users.Find(h.Admin)!.Role = "admin"; db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsJsonAsync($"/api/kyc/{doc}/delete", new { })).StatusCode);
    }

    [Fact]
    public async Task Public_market_history_omits_participant_identifiers()
    {
        using var h = Host();
        h.WithDb(db => { db.ShareTransactions.Add(new ShareTransaction { BuyerId = h.Actor, SellerId = h.Other,
            PropertyId = h.PropertyId, Shares = 1, PricePerShare = 10 }); db.SaveChanges(); });
        var json = await GetJson(h, "/api/share-offers/transactions");
        Assert.DoesNotContain(h.Actor.ToString(), json); Assert.DoesNotContain(h.Other.ToString(), json);
        Assert.Contains("pricePerShare", json); AssertNoSecrets(json);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.GetAsync("/api/admin/stats/settings/cancel-fee")).StatusCode);
    }

    [Theory]
    [InlineData("/api/messages/send")]
    [InlineData("/api/admin/users")]
    [InlineData("/api/admin/demo-accounts")]
    [InlineData("/api/admin/users/{0}/send-monthly-report")]
    [InlineData("/api/properties/{0}/upload-image")]
    [InlineData("/api/properties/{0}/images")]
    [InlineData("/api/properties/{0}/video-url")]
    [InlineData("/api/admin/stats/superuser/update-balance")]
    public async Task Administrative_writes_reject_nonadmin_demo_and_revoked_admin(string route)
    {
        using var h = Host(); route = string.Format(route, h.PropertyId);
        h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync(route, new { })).StatusCode);
        h.Login(h.Demo, demo: true, role: "admin");
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync(route, new { })).StatusCode);
        h.Login(h.Admin, role: "admin");
        h.WithDb(db => { db.Users.Find(h.Admin)!.IsBlocked = true; db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync(route, new { })).StatusCode);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Offer_creation_returns_only_safe_scalar_fields(bool demo)
    {
        using var h = Host(); h.Login(demo ? h.Demo : h.Actor, demo: demo);
        var response = await h.Client.PostAsJsonAsync("/api/share-offers", new { sellerId = h.Other,
            propertyId = h.PropertyId, sharesForSale = 1, startPricePerShare = 10,
            expirationDate = DateTime.UtcNow.AddDays(1), pinOrPassword = demo ? "4444" : "1111" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync(); AssertNoSecrets(raw);
        using var json = JsonDocument.Parse(raw);
        Assert.False(json.RootElement.TryGetProperty("property", out _));
        Assert.False(json.RootElement.TryGetProperty("bids", out _));
        Assert.Equal(demo ? h.Demo : h.Actor, json.RootElement.GetProperty("sellerId").GetGuid());
    }

    [Fact]
    public async Task Admin_broadcast_send_and_owner_inbox_continue_working()
    {
        using var h = Host(); h.Login(h.Admin, role: "admin");
        var response = await h.Client.PostAsJsonAsync("/api/messages/send", new
            { recipientId = h.Actor, title = "Notice", content = "OWN-NOTICE" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        h.Login(h.Actor);
        Assert.Contains("OWN-NOTICE", await GetJson(h, $"/api/messages/inbox/{h.Actor}"));
        h.Login(h.Other);
        Assert.DoesNotContain("OWN-NOTICE", await GetJson(h, $"/api/messages/inbox/{h.Other}"));
    }

    [Theory]
    [InlineData("blocked")]
    [InlineData("expired")]
    [InlineData("template")]
    [InlineData("inactive")]
    [InlineData("deleted")]
    public async Task Revoked_demo_cannot_read_own_private_applications(string state)
    {
        using var h = Host();
        h.WithDb(db => { var d = db.DemoUsers.Find(h.Demo)!;
            if (state == "blocked") d.IsBlocked = true;
            if (state == "expired") d.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            if (state == "template") d.IsTemplate = true;
            if (state == "inactive") d.IsActive = false;
            if (state == "deleted") d.IsDeleted = true;
            db.SaveChanges(); });
        h.Login(h.Demo, demo: true);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync($"/api/applications/user/{h.Demo}")).StatusCode);
    }

    private static async Task<string> GetJson(FinancialTestHost h, string route)
    {
        var response = await h.Client.GetAsync(route);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadAsStringAsync();
    }

    private static void AssertNoSecrets(string raw)
    {
        using var doc = JsonDocument.Parse(raw);
        var forbidden = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        { "password", "passwordHash", "pin", "pinCode", "secretWord", "token", "tokenHash", "accessToken",
          "refreshToken", "refreshTokens", "passwordResetToken", "passwordResetTokens", "resetToken",
          "emailConfirmationToken", "emailConfirmationTokens", "confirmationToken", "authToken" };
        void Check(JsonElement e)
        {
            if (e.ValueKind == JsonValueKind.Object)
                foreach (var p in e.EnumerateObject()) { Assert.DoesNotContain(p.Name, forbidden); Check(p.Value); }
            else if (e.ValueKind == JsonValueKind.Array) foreach (var v in e.EnumerateArray()) Check(v);
        }
        Check(doc.RootElement);
        Assert.DoesNotContain("plain-1111", raw); Assert.DoesNotContain("plain-2222", raw);
    }
}
