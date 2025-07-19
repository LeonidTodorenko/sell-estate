using System.Text;
using System.Text.Json;
using static RealEstateInvestment.Services.FirebaseNotificationService;

namespace RealEstateInvestment.Services
{
    public class FirebaseNotificationService : IFirebaseNotificationService
    {
        private readonly IHttpClientFactory _clientFactory;
        private readonly IConfiguration _config;

        public FirebaseNotificationService(IHttpClientFactory clientFactory, IConfiguration config)
        {
            _clientFactory = clientFactory;
            _config = config;
        }

        public async Task SendNotificationAsync(string token, string title, string body)
        {
            var serverKey = _config["Firebase:ServerKey"];
            var client = _clientFactory.CreateClient();

            client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", $"key={serverKey}");
            client.DefaultRequestHeaders.TryAddWithoutValidation("Content-Type", "application/json");

            var payload = new
            {
                to = token,
                notification = new
                {
                    title,
                    body
                },
                priority = "high"
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync("https://fcm.googleapis.com/fcm/send", content);
            response.EnsureSuccessStatusCode();
        }

       
    }

    public interface IFirebaseNotificationService
    {
        Task SendNotificationAsync(string token, string title, string body);
    }

}
