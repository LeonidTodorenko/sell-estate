using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using Newtonsoft.Json;
using RealEstateInvestment.Data;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;



 

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly AppDbContext _context;

        public AuthController(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        //[HttpPost("register")]
        //public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        //{
        //    if (_context.Users.Any(u => u.Email == request.Email))
        //        return BadRequest(new { message = "Email is in use" });

        //    var user = new User
        //    {
        //        Email = request.Email,
        //        FullName = request.FullName,
        //        PasswordHash = request.Password, //PasswordHasher.HashPassword(request.Password) // todo later hash or jwt
        //        SecretWord = request.SecretWord
        //    };

        //    _context.Users.Add(user);
        //    _context.ActionLogs.Add(new ActionLog
        //    {
        //        UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
        //        Action = "Register",
        //        Details = "User Register Email: " + request.Email
        //    });
        //    await _context.SaveChangesAsync();

        //    return Ok(new { message = "Registered!" });
        //}
         
        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            var user = _context.Users.FirstOrDefault(u => u.Email == request.Email);
            if (user == null || user.PasswordHash != request.Password)    // todo later hash or jwt
                return Unauthorized(new { message = "Invalid email or password" });

            if (!user.IsEmailConfirmed)
                return BadRequest(new { message = "Please confirm your email first." });

            var token = GenerateJwtToken(user);

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = user.Id,
                Action = "Login",
                Details = "User Login  " 
            });

            return Ok(new
            {
                token,
                message = "Login successful",
                userId = user.Id,
                fullName = user.FullName,
                email = user.Email,
                role = user.Role,
                avatarBase64 = user.AvatarBase64,
                walletBalance = user.WalletBalance,
            });
        }

        // todo ролевые аттрибуты
        //[Authorize]
        //[HttpGet("user-profile")]
        //public IActionResult GetProfile()
        //{
        //    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        //    //...
        //}

        // [AllowAnonymous] 	[Authorize]	[Authorize(Roles = "admin")] [Authorize(Roles = "investor")]  	[Authorize(Roles = "admin,investor")]

        //[Authorize(Roles = "admin")]
        //[HttpPost("admin-only")]
        //public IActionResult AdminAction()
        //{
        //   // ...
        //}



        private string GenerateJwtToken(User user)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role)
            };
            var expiresConfig = DateTime.UtcNow.AddMinutes(Convert.ToDouble(_config["Jwt:Expires"]));
            var token = new JwtSecurityToken(
                claims: claims,
                expires: expiresConfig,
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        //public Int32 JwtExpires()
        //{
        //    return Convert.ToInt32(configuration["Jwt:Expires"]);
        //}

        //public IOperationResult<string> GenerateToken(string username, long accountId, string role)
        //{
        //    var result = OperationResult<string>.EmptyBadResult();

        //    try
        //    {
        //        var secKeyConfig = Encoding.UTF8.GetBytes(configuration["Jwt:Key"]);
        //        var issuerConfig = configuration["Jwt:Issuer"];
        //        var audienceConfig = configuration["Jwt:Audience"];
        //        var expiresConfig = DateTime.UtcNow.AddMinutes(Convert.ToDouble(configuration["Jwt:Expires"]));
        //        var securityKey = new SymmetricSecurityKey(secKeyConfig);
        //        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        //        var claims = new[]
        //        {
        //            new Claim(JwtRegisteredClaimNames.Sub, username),
        //            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        //            new Claim(AccountClaimName, accountId.ToString()),
        //            new Claim(_userRoleName, role)
        //        };

        //        var secToken = new JwtSecurityToken(issuerConfig,
        //            audienceConfig,
        //            claims,
        //            expires: expiresConfig,
        //            signingCredentials: credentials);


        //        var token = new JwtSecurityTokenHandler().WriteToken(secToken);

        //        if (string.IsNullOrWhiteSpace(token))
        //        {
        //            result.Message = "Token generation failed. Token is empty, null or whitespace.";
        //            return result;
        //        }

        //        result = OperationResult<string>.OkResult(token);
        //    }
        //    catch (Exception ex)
        //    {
        //        result.Message = ex.InnerException?.Message ?? ex.Message;
        //    }

        //    return result;
        //}

        //public static IOperationResult<string?> GetClaimByName(HttpRequest request, string claimName)
        //{
        //    var authorizationHeader = request.Headers.Authorization.ToString();

        //    if (string.IsNullOrEmpty(authorizationHeader) || !authorizationHeader.StartsWith("Bearer "))
        //        OperationResult<string>.BadResult("JWT Token is missing or invalid.");

        //    var token = authorizationHeader.Substring("Bearer ".Length).Trim();
        //    var handler = new JwtSecurityTokenHandler();
        //    var result = handler.ReadJwtToken(token).Claims.FirstOrDefault(c
        //        => c.Type == claimName)?.Value;

        //    return string.IsNullOrEmpty(result) ? OperationResult<string>.BadResult($"Claim '{claimName}' not found.")
        //        : OperationResult<string>.OkResult(result);
        //}

    }
}
