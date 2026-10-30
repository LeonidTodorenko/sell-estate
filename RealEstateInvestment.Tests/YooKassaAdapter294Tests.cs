using System.Net;
using System.Text;
using Microsoft.Extensions.Options;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using Xunit;

namespace RealEstateInvestment.Tests;

public sealed class YooKassaAdapter294Tests
{
    private sealed class Handler : HttpMessageHandler
    {
        public string? Key,Body,Path;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
        {
            Assert.Equal("api.yookassa.ru",request.RequestUri!.Host);
            Assert.Equal("https",request.RequestUri.Scheme);
            Assert.Equal("Basic",request.Headers.Authorization!.Scheme);
            Path=request.RequestUri.AbsolutePath;
            Key=request.Headers.TryGetValues("Idempotence-Key",out var keys)?keys.Single():null;
            Body=request.Content==null?null:await request.Content.ReadAsStringAsync(ct);
            return new(HttpStatusCode.OK) {Content=new StringContent(Response,Encoding.UTF8,"application/json")};
        }
        public string Response="";
    }
    [Fact] public async Task Adapter_uses_durable_provider_key_capture_and_correlation_and_parses_verification()
    {
        var p=new WalletPayment{Id=Guid.NewGuid(),Amount=123.45m,ReturnUrl="http://localhost:5173/topup"};
        var h=new Handler{Response=System.Text.Json.JsonSerializer.Serialize(new { id="test-id", status="succeeded", test=true, paid=true, recipient=new{account_id="1514010"}, amount=new{value="123.45",currency="RUB"},metadata=new{ownersclub_payment_id=p.Id.ToString()} })};
        var client=new YooKassaPaymentClient(new HttpClient(h),Options.Create(new PaymentOptions{Enabled=true,ShopId="1514010",SecretKey="test_fixture",ReturnUrl=p.ReturnUrl,ChargeUnitsPerWalletUnit=100}));
        var result=await client.Create(p,default);
        Assert.Equal(p.Id.ToString(),h.Key);Assert.Contains("123.45",h.Body);Assert.Contains("\"capture\":true",h.Body);Assert.Contains(p.Id.ToString(),h.Body);
        Assert.Equal(123.45m,result.Amount);Assert.True(result.Test);Assert.True(result.Paid);Assert.Equal(p.Id,result.Correlation);
        await client.Get("test-id",default);Assert.Null(h.Key);Assert.Null(h.Body);Assert.Equal("/v3/payments/test-id",h.Path);
    }
    [Theory] [InlineData("live_key","1514010")] [InlineData("test_fixture","other")]
    public void Disabled_or_live_configuration_cannot_send(string key,string shop)
    {
        Assert.False(new PaymentOptions{Enabled=true,ShopId=shop,SecretKey=key,ReturnUrl="https://example.invalid",ChargeUnitsPerWalletUnit=100}.Ready);
        Assert.False(new PaymentOptions().Ready);
    }
}
