using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using System.Security.Cryptography;
// No application startup, hosted jobs, mail, or credentials on the command line.
var cs=Environment.GetEnvironmentVariable("PASSWORD_MIGRATION_CONNECTION") ?? throw new InvalidOperationException("Set PASSWORD_MIGRATION_CONNECTION privately.");
await using var db=new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(cs).Options);
var users=await db.Users.Select(x=>new {x.Id,x.PasswordHash}).ToListAsync();
var demos=await db.DemoUsers.Select(x=>new {x.Id,x.PasswordHash}).ToListAsync();
var normal=users.Where(u=>PasswordHasher.NeedsRehash(u.PasswordHash)).ToList();
var legacyDemos=demos.Where(u=>PasswordHasher.NeedsRehash(u.PasswordHash)).ToList();
Console.WriteLine($"Pending normal={normal.Count}; demo={legacyDemos.Count}; demo SHA candidates={legacyDemos.Count(u=>PasswordHasher.IsLegacyDemoSha(u.PasswordHash))}");
if(!args.Contains("--apply")) return;
string Arg(string name) {var i=Array.IndexOf(args,name);return i>=0 && i+1<args.Length ? args[i+1] : throw new InvalidOperationException($"Missing {name}");}
var backup=Arg("--verified-backup"); var expected=Arg("--sha256");
using(var stream=File.OpenRead(backup))
    if(!Convert.ToHexString(SHA256.HashData(stream)).Equals(expected,StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Backup hash mismatch");
var demoFormat=Arg("--demo-legacy-format");
if(demoFormat is not ("factory-sha256" or "plaintext" or "skip")) throw new InvalidOperationException("Use factory-sha256, plaintext, or skip after reviewing demo provenance.");
// Optimistic compare-and-swap avoids overwriting a concurrent password reset/login.
await using var tx=await db.Database.BeginTransactionAsync();
var updated=0;
foreach(var u in normal)
{
    var old=u.PasswordHash;var hash=PasswordHasher.HashPassword(old);
    if(!PasswordHasher.VerifyPassword(old,hash)) throw new InvalidOperationException("Hash verification failed");
    updated+=await db.Users.Where(x=>x.Id==u.Id && x.PasswordHash==old).ExecuteUpdateAsync(set=>set.SetProperty(x=>x.PasswordHash,hash));
}
var demoUpdated=0;
if(demoFormat!="skip") foreach(var u in legacyDemos)
{
    var old=u.PasswordHash;
    var hash=demoFormat=="factory-sha256" && PasswordHasher.IsLegacyDemoSha(old) ? PasswordHasher.WrapLegacyDemoSha(old) : PasswordHasher.HashPassword(old);
    demoUpdated+=await db.DemoUsers.Where(x=>x.Id==u.Id && x.PasswordHash==old).ExecuteUpdateAsync(set=>set.SetProperty(x=>x.PasswordHash,hash));
}
await tx.CommitAsync();
Console.WriteLine($"Updated normal={updated}; demo={demoUpdated}. No credentials or identities logged.");
