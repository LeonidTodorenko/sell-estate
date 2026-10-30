using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Services;
using RealEstateInvestment.Models;
using Xunit;
namespace RealEstateInvestment.Tests;
public sealed class WalletPayments295Tests {
 sealed class Gateway:IYooKassaPayments {
  public Task<VerifiedPayment> Create(WalletPayment p,CancellationToken ct)=>Task.FromResult(new VerifiedPayment("psp-"+p.Id,"pending",true,false,p.ShopId,p.Amount,p.ChargeCurrency,p.Id,"https://yookassa.ru/checkout/test"));
  public Task<VerifiedPayment> Get(string id,CancellationToken ct)=>throw new HttpRequestException();
 }
 static PaymentOptions Settings()=>new(){Enabled=true,ShopId="1514010",SecretKey="test_fixture",ReturnUrl="https://example.invalid/top-up",ChargeUnitsPerWalletUnit=80,FeePercent=2.5m};
 static FinancialTestHost Host(PaymentOptions? options=null)=>new(s=>{s.AddSingleton(Options.Create(options??Settings()));s.AddSingleton<IYooKassaPayments>(new Gateway());s.AddScoped<PaymentService>();});
 static async Task<JsonElement> Create(FinancialTestHost h,string method="bank_transfer",Guid? key=null,decimal amount=200){var res=await h.Client.PostAsJsonAsync("/api/payments",new{requestKey=key??Guid.NewGuid(),amount,method});res.EnsureSuccessStatusCode();return await res.Content.ReadFromJsonAsync<JsonElement>();}
 static Task<HttpResponseMessage> Review(FinancialTestHost h,Guid id,string reference="BANK_TEST_295",bool verified=true,decimal received=200,string currency="RUB",string action="confirm",string? link=null)=>h.Client.PostAsJsonAsync($"/api/payments/admin/{id}/review",new{action,reference,fundsIndependentlyVerified=verified,receivedAmount=received,receivedCurrency=currency,paymentLink=link});
 [Fact] public async Task Quote_snapshots_fees_rate_and_history_is_owner_scoped(){
  var options=Settings();using var h=Host(options);h.Login(h.Actor);var key=Guid.NewGuid();var p=await Create(h,key:key);
  Assert.Equal(5,p.GetProperty("feeAmount").GetDecimal());Assert.Equal(2.43m,p.GetProperty("walletAmount").GetDecimal());
  options.ChargeUnitsPerWalletUnit=1;options.FeePercent=0;var retry=await Create(h,key:key);Assert.Equal(2.43m,retry.GetProperty("walletAmount").GetDecimal());
  Assert.Equal(HttpStatusCode.Conflict,(await h.Client.PostAsJsonAsync("/api/payments",new{requestKey=key,amount=200,method="invoice"})).StatusCode);
  Assert.Equal(1,(await h.Client.GetFromJsonAsync<JsonElement>("/api/payments")).GetArrayLength());h.Login(h.Other);Assert.Equal(0,(await h.Client.GetFromJsonAsync<JsonElement>("/api/payments")).GetArrayLength());
  Assert.Equal(HttpStatusCode.NotFound,(await h.Client.GetAsync("/api/payments/"+p.GetProperty("id").GetString())).StatusCode);
  h.WithDb(db=>{Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Empty(db.UserTransactions);});
 }
 [Theory][InlineData("invoice")][InlineData("bank_transfer")][InlineData("assistance")]
 public async Task Manual_receipt_requires_admin_and_independent_evidence_and_replays_once(string method){
  using var h=Host();h.Login(h.Actor);var id=(await Create(h,method)).GetProperty("id").GetGuid();
  Assert.Equal(HttpStatusCode.Forbidden,(await Review(h,id)).StatusCode);h.Login(h.Admin,role:"admin");
  Assert.Equal(HttpStatusCode.BadRequest,(await Review(h,id,verified:false)).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await Review(h,id,received:199)).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await Review(h,id,currency:"USD")).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await Review(h,id,reference:"4111111111111111")).StatusCode);
  Assert.Equal(HttpStatusCode.OK,(await Review(h,id,action:"processing",link:"https://yookassa.ru/my/i/test")).StatusCode);
  h.WithDb(db=>{Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Empty(db.UserTransactions);});
  Assert.Equal(HttpStatusCode.OK,(await Review(h,id)).StatusCode);Assert.Equal(HttpStatusCode.OK,(await Review(h,id,reference:"bank_test_295")).StatusCode);
  h.WithDb(db=>{Assert.Equal(1002.43m,db.Users.Find(h.Actor)!.WalletBalance);Assert.Single(db.UserTransactions.Where(x=>x.Id==id));Assert.Single(db.ActionLogs.Where(x=>x.Id==id));});
 }
 [Fact] public async Task Duplicate_receipt_reference_rolls_back_second_credit(){
  using var h=Host();h.Login(h.Actor);var first=(await Create(h)).GetProperty("id").GetGuid();var second=(await Create(h)).GetProperty("id").GetGuid();h.Login(h.Admin,role:"admin");
  Assert.Equal(HttpStatusCode.OK,(await Review(h,first)).StatusCode);Assert.Equal(HttpStatusCode.Conflict,(await Review(h,second,reference:"bank_test_295")).StatusCode);
  h.WithDb(db=>{Assert.Equal(1002.43m,db.Users.Find(h.Actor)!.WalletBalance);Assert.Null(db.Payments.Find(second)!.CreditedAt);Assert.Single(db.UserTransactions);});
 }
 [Fact] public async Task Reject_is_terminal_and_provider_payment_cannot_be_manually_credited(){
  using var h=Host();h.Login(h.Actor);var id=(await Create(h)).GetProperty("id").GetGuid();var online=(await Create(h,"yookassa")).GetProperty("id").GetGuid();h.Login(h.Admin,role:"admin");
  Assert.Equal(HttpStatusCode.BadRequest,(await Review(h,id,action:"processing",link:"https://attacker.invalid/pay")).StatusCode);
  Assert.Equal(HttpStatusCode.OK,(await Review(h,id,action:"reject")).StatusCode);Assert.Equal(HttpStatusCode.Conflict,(await Review(h,id)).StatusCode);
  Assert.Equal(HttpStatusCode.Conflict,(await Review(h,online)).StatusCode);h.WithDb(db=>{Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Empty(db.UserTransactions);});
 }
 [Fact] public async Task Revoked_admin_and_demo_tokens_cannot_review(){
  using var h=Host();h.Login(h.Actor);var id=(await Create(h)).GetProperty("id").GetGuid();h.WithDb(db=>{db.Users.Find(h.Admin)!.Role="investor";db.SaveChanges();});h.Login(h.Admin,role:"admin");Assert.Equal(HttpStatusCode.Forbidden,(await Review(h,id)).StatusCode);
  h.Login(h.Demo,true,"admin");Assert.Equal(HttpStatusCode.Forbidden,(await Review(h,id)).StatusCode);Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.GetAsync("/api/payments")).StatusCode);
 }
 [Fact] public async Task Journal_failure_rolls_back_manual_balance_and_settlement(){
  using var h=Host();h.Login(h.Actor);var id=(await Create(h)).GetProperty("id").GetGuid();
  h.WithDb(db=>{db.ActionLogs.Add(new(){Id=id,UserId=h.Actor,Action="Existing",Details="Fixture"});db.SaveChanges();});h.Login(h.Admin,role:"admin");
  Assert.Equal(HttpStatusCode.Conflict,(await Review(h,id)).StatusCode);h.WithDb(db=>{Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Null(db.Payments.Find(id)!.CreditedAt);Assert.Empty(db.UserTransactions);});
 }
 [Theory][InlineData(0)][InlineData(10001)][InlineData(1.001)]
 public async Task Invalid_amounts_do_not_create_payments(decimal amount){using var h=Host();h.Login(h.Actor);Assert.Equal(HttpStatusCode.Conflict,(await h.Client.PostAsJsonAsync("/api/payments",new{requestKey=Guid.NewGuid(),amount,method="yookassa"})).StatusCode);h.WithDb(db=>Assert.Empty(db.Payments));}
 [Fact] public async Task Mobile_return_is_fixed_and_does_not_credit_wallet(){
  using var h=Host();h.Login(h.Actor);
  var result=await h.Client.PostAsJsonAsync("/api/payments",new{requestKey=Guid.NewGuid(),amount=200,method="yookassa",client="android"});result.EnsureSuccessStatusCode();
  h.WithDb(db=>{Assert.Equal("ownersclub://payments/return",db.Payments.Single().ReturnUrl);Assert.Equal(1000,db.Users.Find(h.Actor)!.WalletBalance);Assert.Empty(db.UserTransactions);});
  Assert.Equal(HttpStatusCode.Gone,(await h.Client.PostAsJsonAsync("/api/payments/simulate-payment",200)).StatusCode);
 }
}
