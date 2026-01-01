namespace RealEstateInvestment.Helpers
{
    using System.Security.Cryptography;

    public static class ClientNumberGenerator
    {
        // 9 символов, без O/0/I/1 чтобы не путаться
        private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        public static string Generate(int length = 9)
        {
            var bytes = RandomNumberGenerator.GetBytes(length);
            var chars = new char[length];
            for (int i = 0; i < length; i++)
                chars[i] = Alphabet[bytes[i] % Alphabet.Length];
            return new string(chars);
        }
    }

}
