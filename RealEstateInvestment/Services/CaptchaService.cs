using System.Collections.Concurrent;


namespace RealEstateInvestment.Services
{
  
    public class CaptchaService
    {
        private readonly ConcurrentDictionary<Guid, int> _captchaStore = new();

        public (Guid id, string expression) Generate()
        {
            var rnd = new Random();
            int a = rnd.Next(1, 10);
            int b = rnd.Next(1, 10);
            int result = a + b;

            var id = Guid.NewGuid();
            _captchaStore[id] = result;

            return (id, $"{a} + {b}");
        }

        public bool Verify(Guid id, int answer)
        {
            if (_captchaStore.TryRemove(id, out var correctAnswer))
            {
                return answer == correctAnswer;
            }
            return false;
        }
    }

}
