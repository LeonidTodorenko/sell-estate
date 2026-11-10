using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using Xunit;

namespace RealEstateInvestment.Tests;

[Collection("Ledger292Postgres")]
public sealed class PaymentEvidence306Tests
{
    private static FinancialTestHost Host(bool postgres = false) => new(s => {
        s.AddSingleton(Options.Create(new PaymentOptions { Enabled=true, ShopId="1514010", SecretKey="test_fixture",
            ReturnUrl="https://example.invalid/top-up", ChargeUnitsPerWalletUnit=80 }));
        s.AddSingleton<IYooKassaPayments, NoGateway>();
        s.AddScoped<PaymentService>();
    }, isolatedPostgres:postgres ? Environment.GetEnvironmentVariable("QA292_DB") : null);

    private static Guid Seed(FinancialTestHost h, bool test=true) {
        var id=Guid.NewGuid(); h.WithDb(db=>{db.Payments.Add(new WalletPayment { Id=id, UserId=h.Actor,
            RequestKey=Guid.NewGuid(), Amount=200, WalletAmount=2.5m, ExchangeRate=80,
            Method="bank_transfer", Status="requested", IsTest=test });db.SaveChanges();});
        h.Login(h.Actor);return id;
    }
    private static Task<HttpResponseMessage> Upload(FinancialTestHost h, Guid id, byte[]? bytes=null, string mime="application/pdf",string comment="TEST receipt") {
        var body=new MultipartFormDataContent();body.Add(new StringContent(comment),"comment");
        if(bytes!=null){var part=new ByteArrayContent(bytes);part.Headers.ContentType=new MediaTypeHeaderValue(mime);body.Add(part,"file","../../unsafe.pdf");}
        return h.Client.PostAsync($"/api/payments/{id}/evidence",body);
    }
    private static byte[] Pdf => Encoding.ASCII.GetBytes("%PDF-1.4\nTEST fixture\n%%EOF\n");

    [Fact]
    public async Task Private_upload_download_and_clarification_preserve_wallet_and_enforce_roles() {
        using var h=Host();var id=Seed(h);
        var response=await Upload(h,id,Pdf);Assert.Equal(HttpStatusCode.OK,response.StatusCode);
        var file=(await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var path=$"/api/payments/{id}/evidence";
        h.Login(h.Other);Assert.Equal(HttpStatusCode.NotFound,(await h.Client.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await h.Client.GetAsync(path+$"/{file}/file")).StatusCode);
        h.Login(h.Actor);Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.PostAsJsonAsync(path+"/clarification",new{comment="Need date"})).StatusCode);
        h.Login(h.Admin,role:"admin");Assert.Equal(HttpStatusCode.OK,(await h.Client.PostAsJsonAsync(path+"/clarification",new{comment="Need date"})).StatusCode);
        var download=await h.Client.GetAsync(path+$"/{file}/file");Assert.Equal(Pdf,await download.Content.ReadAsByteArrayAsync());
        Assert.True(download.Headers.CacheControl!.NoStore);Assert.Equal("nosniff",download.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.DoesNotContain("unsafe",download.Content.Headers.ContentDisposition!.FileName);
        h.Login(h.Actor);Assert.Equal(HttpStatusCode.OK,(await Upload(h,id,Pdf,comment:"Date supplied")).StatusCode);
        h.WithDb(db=>{Assert.Equal(1000m,db.Users.Find(h.Actor)!.WalletBalance);Assert.Empty(db.UserTransactions);
            Assert.Equal("requested",db.Payments.Find(id)!.Status);Assert.Equal(3,db.Set<PaymentEvidence>().Count());Assert.Equal(3,db.ActionLogs.Count());});
    }

    [Theory]
    [InlineData("application/pdf","<script>bad</script>")]
    [InlineData("image/png","%PDF-1.4\n%%EOF")]
    [InlineData("text/plain","%PDF-1.4\n%%EOF")]
    public async Task Spoofed_signature_or_MIME_is_rejected(string mime,string body) {
        using var h=Host();var id=Seed(h);Assert.Equal(HttpStatusCode.BadRequest,(await Upload(h,id,Encoding.ASCII.GetBytes(body),mime)).StatusCode);
        h.WithDb(db=>Assert.Empty(db.Set<PaymentEvidence>()));
    }

    [Fact]
    public async Task Limits_closed_requests_live_and_demo_are_rejected() {
        using var h=Host();var id=Seed(h);
        Assert.Equal(HttpStatusCode.BadRequest,(await Upload(h,id,new byte[5*1024*1024+1])).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await Upload(h,id,comment:new string('x',2001))).StatusCode);
        for(var i=0;i<5;i++)Assert.Equal(HttpStatusCode.OK,(await Upload(h,id,Pdf)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await Upload(h,id,Pdf)).StatusCode);
        h.WithDb(db=>{db.Payments.Find(id)!.Status="rejected";db.SaveChanges();});
        Assert.Equal(HttpStatusCode.Conflict,(await Upload(h,id)).StatusCode);
        var live=Seed(h,false);Assert.Equal(HttpStatusCode.Conflict,(await Upload(h,live,Pdf)).StatusCode);
        h.Login(h.Demo,demo:true);Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.GetAsync($"/api/payments/{id}/evidence")).StatusCode);
    }

    [Local292Fact]
    public async Task PostgreSQL_clarify_reupload_then_approve_twice_credits_once_and_closes_uploads() {
        using var h=Host(true);var id=Seed(h);
        Assert.Equal(HttpStatusCode.OK,(await Upload(h,id,Pdf)).StatusCode);
        h.Login(h.Admin,role:"admin");
        Assert.Equal(HttpStatusCode.OK,(await h.Client.PostAsJsonAsync($"/api/payments/{id}/evidence/clarification",new{comment="Need date"})).StatusCode);
        h.Login(h.Actor);Assert.Equal(HttpStatusCode.OK,(await Upload(h,id,Pdf,comment:"Date attached")).StatusCode);
        h.Login(h.Admin,role:"admin");
        var outcomes=await Task.WhenAll(Enumerable.Range(0,2).Select(_=>h.Client.PostAsJsonAsync($"/api/payments/admin/{id}/review",new{action="confirm"})));
        Assert.All(outcomes,r=>Assert.Equal(HttpStatusCode.OK,r.StatusCode));
        h.Login(h.Actor);Assert.Equal(HttpStatusCode.Conflict,(await Upload(h,id,Pdf)).StatusCode);
        h.WithDb(db=>{Assert.Equal(1002.5m,db.Users.Find(h.Actor)!.WalletBalance);Assert.Single(db.UserTransactions.Where(x=>x.Id==id));Assert.Single(db.ActionLogs.Where(x=>x.Action=="PaymentReview"&&x.Id==id));});
    }

    [Fact]
    public async Task Admin_messages_route_and_two_way_chat_are_private() {
        using var h=Host();h.Login(h.Actor);
        Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.GetAsync("/api/messages/all")).StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await h.Client.PostAsJsonAsync("/api/chat/send",new{recipientId=h.Admin,content="Question"})).StatusCode);
        h.Login(h.Admin,role:"admin");
        Assert.Equal(HttpStatusCode.OK,(await h.Client.GetAsync("/api/messages/all")).StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await h.Client.PostAsJsonAsync("/api/messages/send",new{title="Notice",content="Private notice",recipientId=h.Actor})).StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await h.Client.PostAsJsonAsync("/api/chat/send",new{recipientId=h.Actor,content="Answer"})).StatusCode);
        h.Login(h.Actor);var path=$"/api/chat/conversation/{h.Actor}/{h.Admin}";
        Assert.Equal(2,(await h.Client.GetFromJsonAsync<JsonElement>(path)).GetArrayLength());
        h.Login(h.Other);Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.GetAsync(path)).StatusCode);
        var inbox=await h.Client.GetFromJsonAsync<JsonElement>($"/api/messages/inbox/{h.Other}");Assert.Equal(0,inbox.GetArrayLength());
    }
    private sealed class NoGateway:IYooKassaPayments {
        public Task<VerifiedPayment> Create(WalletPayment p,CancellationToken ct)=>throw new InvalidOperationException("No gateway allowed");
        public Task<VerifiedPayment> Get(string id,CancellationToken ct)=>throw new InvalidOperationException("No gateway allowed");
    }
}
