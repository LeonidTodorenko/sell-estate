using System.Security.Cryptography;
using System.Text;
 
namespace RealEstateInvestment.Helpers
{
    public class ReferralCode
    {

         public static string Generate(int bytes = 18)
        {
            var rnd = RandomNumberGenerator.GetBytes(bytes);
            return Convert.ToBase64String(rnd)
                .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        }

        public static string Hash(string code)
        {
            using var sha = SHA256.Create();
            var buf = sha.ComputeHash(Encoding.UTF8.GetBytes(code));
            return Convert.ToBase64String(buf);
        }
    }
}
