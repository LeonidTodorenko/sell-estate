using Microsoft.AspNetCore.Mvc;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
 
namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AuthController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (_context.Users.Any(u => u.Email == request.Email))
                return BadRequest(new { message = "Email is in use" });

            var user = new User
            {
                Email = request.Email,
                FullName = request.FullName,
                PasswordHash = request.Password //PasswordHasher.HashPassword(request.Password) // todo later hash or jwt
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Registered!" });
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            var user = _context.Users.FirstOrDefault(u => u.Email == request.Email);
            if (user == null || user.PasswordHash != request.Password)    // todo later hash or jwt
                return Unauthorized(new { message = "Invalid email or password" });

            return Ok(new
            {
                message = "Login successful",
                userId = user.Id,
                fullName = user.FullName,
                email = user.Email,
                walletBalance = user.WalletBalance,
            });
        }
    }
}
