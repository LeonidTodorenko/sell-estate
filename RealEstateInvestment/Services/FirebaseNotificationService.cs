using Google.Apis.Auth.OAuth2;
using System.Text;
using System.Text.Json;

namespace RealEstateInvestment.Services
{
    public class FirebaseNotificationService : IFirebaseNotificationService
    {
        private readonly IConfiguration _config;
        private readonly string _projectId;
        private readonly GoogleCredential _credential;

        public FirebaseNotificationService(IConfiguration config)
        {
            _config = config;

            var path = _config["Firebase:CredentialsPath"];
            if (string.IsNullOrEmpty(path))
                throw new InvalidOperationException("Firebase credentials path not configured");

            _credential = GoogleCredential
                .FromFile(path)
                .CreateScoped("https://www.googleapis.com/auth/firebase.messaging");

            var json = File.ReadAllText(path);
            var parsed = JsonSerializer.Deserialize<Dictionary<string, object>>(json);
            _projectId = parsed?["project_id"]?.ToString() ?? throw new InvalidOperationException("Missing project_id");
        }

        public async Task SendNotificationAsync(string token, string title, string body)
        {
            var accessToken = await _credential.UnderlyingCredential.GetAccessTokenForRequestAsync();

            var message = new
            {
                message = new
                {
                    token,
                    notification = new
                    {
                        title,
                        body
                    }
                }
            };

            var jsonPayload = JsonSerializer.Serialize(message);
            var request = new HttpRequestMessage(HttpMethod.Post, $"https://fcm.googleapis.com/v1/projects/{_projectId}/messages:send")
            {
                Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json")
            };

            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

            using var httpClient = new HttpClient();
            var response = await httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                var responseText = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"FCM send failed: {response.StatusCode}, {responseText}");
            }
        }
    }

    public interface IFirebaseNotificationService
    {
        Task SendNotificationAsync(string token, string title, string body);
    }
}
