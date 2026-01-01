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
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.EntityFrameworkCore;







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
        //        UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later
        //        Action = "Register",
        //        Details = "User Register Email: " + request.Email
        //    });
        //    await _context.SaveChangesAsync();

        //    return Ok(new { message = "Registered!" });
        //}
         
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            try
            {
                var user = _context.Users.FirstOrDefault(u => u.Email == request.Email);
                if (user == null || user.PasswordHash != request.Password)    // todo later hash or jwt
                    return Unauthorized(new { message = "Invalid email or password" });

                if (!user.IsEmailConfirmed)
                    return BadRequest(new { message = "Please confirm your email first." });

                // подчистим старьё только этого пользователя
                await CleanupExpiredRefreshTokens(user.Id);

                // гасим все активные refresh для этого пользователя
                var activeUserTokens = await _context.RefreshTokens
                    .Where(x => x.UserId == user.Id && x.RevokedAt == null && x.ExpiresAt > DateTime.UtcNow)
                    .ToListAsync();

                foreach (var t in activeUserTokens) t.RevokedAt = DateTime.UtcNow;


                var accessToken = GenerateJwtToken(user, minutes: GetAccessLifetimeMinutes());
                var (refreshPlain, refreshHash) = GenerateRefreshPair();

                // var token = GenerateJwtToken(user);

                var refreshRow = new RefreshToken
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    TokenHash = refreshHash,
                    ExpiresAt = DateTime.UtcNow.AddDays(GetRefreshLifetimeDays()),
                    CreatedAt = DateTime.UtcNow,
                    UserAgent = Request.Headers["User-Agent"].ToString(),
                    Ip = HttpContext.Connection.RemoteIpAddress?.ToString()
                };


                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = user.Id,
                    Action = "Login",
                    Details = "User Login:  " + user.Email,
                });



                _context.RefreshTokens.Add(refreshRow);

                await _context.SaveChangesAsync();



                //return Ok(new
                //{
                //    token,
                //    message = "Login successful",
                //    userId = user.Id,
                //    fullName = user.FullName,
                //    email = user.Email,
                //    role = user.Role,
                //    avatarBase64 = user.AvatarBase64,
                //    walletBalance = user.WalletBalance,
                //});

                return Ok(new
                {
                    accessToken,
                    refreshToken = refreshPlain,
                    user = new
                    {
                        id = user.Id,
                        fullName = user.FullName,
                        email = user.Email,
                        role = user.Role,
                        avatarBase64 = user.AvatarBase64,
                        walletBalance = user.WalletBalance
                    }
                });
            }
            catch (Exception ex)
            {
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo check
                    Action = "user login error",
                    Details = ex.Message,
                });
                await _context.SaveChangesAsync();
                return BadRequest(new { message = ex.Message });
            }

        }

        public class RefreshRequest { public string? RefreshToken { get; set; } }

        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh([FromBody] RefreshRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.RefreshToken))
                return Unauthorized(new { message = "Missing refresh token" });

            var hash = HashRefresh(req.RefreshToken!);

            var tokenRow = await _context.RefreshTokens
    .Where(x => x.TokenHash == hash && x.RevokedAt == null && x.ExpiresAt > DateTime.UtcNow)
    .FirstOrDefaultAsync();

            if (tokenRow == null) return Unauthorized(new { message = "Invalid refresh token" });

            var user = await _context.Users.FindAsync(tokenRow.UserId);
            if (user == null) return Unauthorized();

            // ротация
            tokenRow.RevokedAt = DateTime.UtcNow;


            // Ищем строку refresh по хэшу (проверка VerifyHash)
            //var active = await _context.RefreshTokens
            //    .Where(x => x.RevokedAt == null && x.ExpiresAt > DateTime.UtcNow)
            //    .OrderByDescending(x => x.CreatedAt)
            //    .ToListAsync();

            //var tokenRow = active.FirstOrDefault(x => VerifyRefresh(req.RefreshToken!, x.TokenHash));
            //if (tokenRow == null) return Unauthorized(new { message = "Invalid refresh token" });

            //var user = await _context.Users.FindAsync(tokenRow.UserId);
            //if (user == null) return Unauthorized();

            //// Ротация: старый гасим, выдаём новый
            //tokenRow.RevokedAt = DateTime.UtcNow;

            var (newPlain, newHash) = GenerateRefreshPair();
            var newRow = new RefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TokenHash = newHash,
                ExpiresAt = DateTime.UtcNow.AddDays(GetRefreshLifetimeDays()),
                CreatedAt = DateTime.UtcNow,
                UserAgent = Request.Headers["User-Agent"].ToString(),
                Ip = HttpContext.Connection.RemoteIpAddress?.ToString()
            };
            _context.RefreshTokens.Add(newRow);

            var newAccess = GenerateJwtToken(user, minutes: GetAccessLifetimeMinutes());

            await _context.SaveChangesAsync();

            await CleanupExpiredRefreshTokens(user.Id);

            return Ok(new
            {
                accessToken = newAccess,
                refreshToken = newPlain
            });
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout([FromBody] RefreshRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.RefreshToken))
                return Ok(); // idempotent

            var active = await _context.RefreshTokens
                .Where(x => x.RevokedAt == null && x.ExpiresAt > DateTime.UtcNow)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

            var tokenRow = active.FirstOrDefault(x => VerifyRefresh(req.RefreshToken!, x.TokenHash));
            if (tokenRow != null)
            {
                tokenRow.RevokedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                // подчистим мусор этого пользователя
                await CleanupExpiredRefreshTokens(tokenRow.UserId);
            }
            return Ok();
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> Me()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userIdStr, out var userId)) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return Unauthorized();

            return Ok(new
            {
                id = user.Id,
                fullName = user.FullName,
                email = user.Email,
                role = user.Role,
                avatarBase64 = user.AvatarBase64,
                walletBalance = user.WalletBalance
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

        private int GetAccessLifetimeMinutes()
        {
            // appsettings: "Jwt": { "AccessMinutes": 20 }
            var val = _config["Jwt:AccessMinutes"];
            return int.TryParse(val, out var m) ? m : 20;
        }

        private int GetRefreshLifetimeDays()
        {
            // appsettings: "Jwt": { "RefreshDays": 30 }
            var val = _config["Jwt:RefreshDays"];
            return int.TryParse(val, out var d) ? d : 30;
        }


        // без минут
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

        private string GenerateJwtToken(User user, int minutes)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email ?? string.Empty),
                new Claim(ClaimTypes.Role, user.Role ?? "user")
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(minutes),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        // Пара "plain + hash" для refresh. Hash — SHA256 base64.
        private (string plain, string hash) GenerateRefreshPair()
        {
            var plain = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            var hash = HashRefresh(plain);
            return (plain, hash);
        }

        private static string HashRefresh(string plain)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(plain));
            return Convert.ToBase64String(bytes);
        }

        private static bool VerifyRefresh(string plain, string hashBase64)
        {
            return HashRefresh(plain) == hashBase64;
        }

        private async Task CleanupExpiredRefreshTokens(Guid? userId = null)
        {
            var now = DateTime.UtcNow;

            // удаляем:
            // 1) все истёкшие (ExpiresAt <= now)
            // 2) все уже ревокнутые, которые лежат дольше 7 дней (на случай форензики оставляем короткий retention)
            var q = _context.RefreshTokens.AsQueryable();

            if (userId.HasValue)
                q = q.Where(t => t.UserId == userId.Value);

            q = q.Where(t =>
                t.ExpiresAt <= now ||
                (t.RevokedAt != null && t.RevokedAt <= now.AddDays(-7))
            );

            var toRemove = await q.ToListAsync();
            if (toRemove.Count > 0)
            {
                _context.RefreshTokens.RemoveRange(toRemove);
                await _context.SaveChangesAsync();
            }
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

    public class LoginRequest
    {
        public string Email { get; set; } = default!;
        public string Password { get; set; } = default!;
    }


}
