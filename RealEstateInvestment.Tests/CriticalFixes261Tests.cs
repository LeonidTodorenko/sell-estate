using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Controllers;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using Xunit;
namespace RealEstateInvestment.Tests;
[Collection("RestoredPostgres")]
public class CriticalFixes261Tests
{
    [Fact] public void HashesAreSaltedAndCannotBeUsedAsPasswords()
    {
        var a=PasswordHasher.HashPassword("example-only-261");
        var b=PasswordHasher.HashPassword("example-only-261");
        Assert.NotEqual(a,b); Assert.True(PasswordHasher.VerifyPassword("example-only-261",a));
        Assert.False(PasswordHasher.VerifyPassword(a,a)); Assert.False(PasswordHasher.VerifyPassword("wrong",a));
        Assert.False(PasswordHasher.VerifyPassword("anything","$oc$malformed"));
    }
    [Fact] public void DemoLegacyDigestCannotBeSubmittedAsPassword()
    {
        var digest=Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("demo-261")));
        Assert.True(PasswordHasher.VerifyDemoPassword("demo-261",digest));
        Assert.False(PasswordHasher.VerifyDemoPassword(digest,digest));
        var wrapped=PasswordHasher.WrapLegacyDemoSha(digest);
        Assert.True(PasswordHasher.VerifyDemoPassword("demo-261",wrapped));
        Assert.False(PasswordHasher.VerifyDemoPassword(digest,wrapped));
    }
    [Fact] public async Task ResetThenChangeStoresHashesAndConsumesToken()
    {
        using var h=new FinancialTestHost();
        h.WithDb(db=> {db.PasswordResetTokens.Add(new PasswordResetToken {UserId=h.Actor,Token="qa261-reset"});db.SaveChanges();});
        var reset=await h.Client.PostAsJsonAsync("/api/users/reset-password",new {token="qa261-reset",newPassword="reset-261"});
        Assert.Equal(HttpStatusCode.OK,reset.StatusCode);
        h.WithDb(db=> {var u=db.Users.Find(h.Actor)!;Assert.False(PasswordHasher.NeedsRehash(u.PasswordHash));Assert.True(PasswordHasher.VerifyPassword("reset-261",u.PasswordHash));Assert.Empty(db.PasswordResetTokens);});
        Assert.Equal(HttpStatusCode.BadRequest,(await h.Client.PostAsJsonAsync("/api/users/reset-password",new {token="qa261-reset",newPassword="other"})).StatusCode);
        h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.OK,(await h.Client.PostAsJsonAsync($"/api/users/{h.Actor}/change-password",new {currentPassword="reset-261",newPassword="changed-261"})).StatusCode);
        h.WithDb(db=> {var u=db.Users.Find(h.Actor)!;Assert.True(PasswordHasher.VerifyPassword("changed-261",u.PasswordHash));Assert.False(PasswordHasher.VerifyPassword("reset-261",u.PasswordHash));});
    }
    [Fact] public async Task LoginUpgradesLegacyPasswordWithoutReturningIt()
    {
        using var h=new FinancialTestHost();
        using var scope=h.Services.CreateScope();
        var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cfg=new Microsoft.Extensions.Configuration.ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
            ["Jwt:Key"]="qa261-isolated-signing-key-at-least-32-bytes",["Jwt:Issuer"]="isolated-tests",["Jwt:Audience"]="isolated-tests"
        }).Build();
        var c=new AuthController(db,cfg) { ControllerContext=new ControllerContext {HttpContext=new Microsoft.AspNetCore.Http.DefaultHttpContext()} };
        var user=await db.Users.FindAsync(h.Actor);
        user!.PasswordHash="plain-1111"; await db.SaveChangesAsync();
        var result=await c.Login(new RealEstateInvestment.Controllers.LoginRequest {Email=user!.Email,Password="plain-1111"});
        Assert.IsType<OkObjectResult>(result);
        Assert.False(PasswordHasher.NeedsRehash(user.PasswordHash));
        Assert.DoesNotContain(user.PasswordHash,JsonSerializer.Serialize(result));
    }
    [RestoredPostgresFact] public async Task RestoredPostgresStatsPreserveEveryDigit()
    {
        var cs=Environment.GetEnvironmentVariable("QA261_RESTORED_DB");
        if(string.IsNullOrEmpty(cs)) throw new InvalidOperationException("Restored DB is required");
        await using var db=new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(cs).Options);
        await db.Database.OpenConnectionAsync();
        await using var cmd=db.Database.GetDbConnection().CreateCommand();
        cmd.CommandText="SELECT COALESCE(SUM(\"InvestedAmount\"),0)::text FROM \"Investments\"";
        var exact=(string)(await cmd.ExecuteScalarAsync())!;
        var result=Assert.IsType<OkObjectResult>(await new AdminStatsController(null!,db,null!,null!).GetStats());
        using var json=JsonDocument.Parse(JsonSerializer.Serialize(result.Value));
        Assert.Equal(exact,json.RootElement.GetProperty("totalInvestments").GetRawText());
        cmd.CommandText="CREATE TEMP TABLE \"Investments\" (\"InvestedAmount\" numeric); INSERT INTO \"Investments\" VALUES (358877.5000000000000000000000001), (-1), (1)";
        await cmd.ExecuteNonQueryAsync();
        Assert.Equal("358877.5000000000000000000000001",JsonSerializer.Serialize(await ExactStatsSum.InvestmentsAsync(db)));
        cmd.CommandText="TRUNCATE \"Investments\""; await cmd.ExecuteNonQueryAsync();
        Assert.Equal("0",JsonSerializer.Serialize(await ExactStatsSum.InvestmentsAsync(db)));
        cmd.CommandText="DROP TABLE pg_temp.\"Investments\""; await cmd.ExecuteNonQueryAsync();
    }
}



public sealed class RestoredPostgresFactAttribute : FactAttribute
{
    public RestoredPostgresFactAttribute() { if(string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("QA261_RESTORED_DB"))) Skip="Requires an explicitly restored PostgreSQL database"; }
}
