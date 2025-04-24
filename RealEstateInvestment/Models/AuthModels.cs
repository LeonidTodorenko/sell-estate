using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    //public class RegisterRequest
    //{
    //    [Required, EmailAddress]
    //    public string Email { get; set; }

    //    [Required, MinLength(6)]
    //    public string Password { get; set; }

    //    [Required]
    //    public string FullName { get; set; }

    //    [Required]
    //    public string SecretWord { get; set; }

    //    [Required]
    //    public string CaptchaToken { get; set; }
    //}

    public class LoginRequest
    {
        [Required, EmailAddress]
        public string Email { get; set; }

        [Required]
        public string Password { get; set; }
    }
}
