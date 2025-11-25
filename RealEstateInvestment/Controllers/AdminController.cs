using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Dtos;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/admin")]
    public class AdminController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _cfg;
        private readonly EmailService _emailService;
         
        public AdminController(AppDbContext db, IConfiguration cfg, EmailService emailService )
        {
            _db = db;
            _cfg = cfg;
            _emailService = emailService;
         
        }

        private async Task<User?> CurrentUserAsync()
        {
            var id = User.GetUserId();
            return await _db.Users.FirstOrDefaultAsync(x => x.Id == id);
        }

        [HttpGet("users")]
        public async Task<IActionResult> GetUsers([FromQuery] string? query)
        {
            var me = await CurrentUserAsync();
            if (me == null || !(me.IsAdmin() || me.IsSuperAdmin(_cfg)))
                return Forbid();

            var q = _db.Users.AsQueryable();

            if (!string.IsNullOrWhiteSpace(query))
            {
                var qLower = query.ToLower();
                q = q.Where(u => u.FullName.ToLower().Contains(qLower)
                              || u.Email.ToLower().Contains(qLower));
            }

            var raw = await q
                .OrderByDescending(u => u.CreatedAt)
                .Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    UserRole = (int)u.UserRole,
                    u.Permissions,
                    u.IsBlocked,
                    u.IsEmailConfirmed,
                    u.CreatedAt
                })
                .ToListAsync();

            var list = raw.Select(u => new AdminUserListItemDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email,

                UserRole = u.UserRole,
                UserRoleText = ((UserRole)u.UserRole).ToString(),

                Permissions = (long)u.Permissions,
                PermissionsText = EnumHelpers.FlagsToNames((PermissionFlags)u.Permissions),

                IsBlocked = u.IsBlocked,
                IsEmailConfirmed = u.IsEmailConfirmed,
                CreatedAt = u.CreatedAt
            }).ToList();

            return Ok(list);


        }

        [AllowAnonymous]
        [HttpPost("users")]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest req)
        {
            var me = await CurrentUserAsync();
            if (me == null) return Unauthorized();

            var isSuper = me.IsSuperAdmin(_cfg);
            var isAdmin = me.IsAdmin();

            if (!isAdmin && !isSuper) return Forbid();

            // Admin не может создавать Admin и не может задавать флаги
            if (!isSuper && (req.Role == UserRole.Admin || req.Permissions.HasValue))
                return Forbid();

            if (await _db.Users.AnyAsync(u => u.Email.ToLower() == req.Email.ToLower()))
                return BadRequest(new { message = "Email already in use" });

            var user = new User
            {
                FullName = req.FullName,
                Email = req.Email,
                PasswordHash = req.Password, // TODO hash
                SecretWord = "created-by-admin",
                Role = req.Role == UserRole.Admin ? "admin" : "investor", // временно
                UserRole = req.Role,
                Permissions = isSuper ? (req.Permissions ?? PermissionFlags.None) : PermissionFlags.None,
                IsEmailConfirmed = true // создан админом
            };

            _db.Users.Add(user);
            _db.ActionLogs.Add(new ActionLog
            {
                UserId = me.Id,
                Action = "CreateUserAsAdmin",
                Details = $"Created {user.Email} with role {user.UserRole}, perms={(long)user.Permissions}"
            });

            await _db.SaveChangesAsync();
            return Ok(new { message = "User created", userId = user.Id });
        }

        [HttpGet("users/{id:guid}")]
        public async Task<IActionResult> GetUserDetails(Guid id)
        {
            var me = await CurrentUserAsync();
            if (me == null || !(me.IsAdmin() || me.IsSuperAdmin(_cfg)))
                return Forbid();

            var u = await _db.Users
                .Where(x => x.Id == id)
                .Select(x => new
                {
                    x.Id,
                    x.FullName,
                    x.Email,
                    UserRole = (int)x.UserRole,
                    x.Permissions,
                    x.IsBlocked,
                    x.IsEmailConfirmed,
                    x.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (u == null) return NotFound();

            var dto = new
            {
                id = u.Id,
                fullName = u.FullName,
                email = u.Email,
                userRole = u.UserRole,
                userRoleText = ((UserRole)u.UserRole).ToString(),
                permissions = (long)u.Permissions,
                permissionsText = EnumHelpers.FlagsToNames((PermissionFlags)u.Permissions),
                isBlocked = u.IsBlocked,
                isEmailConfirmed = u.IsEmailConfirmed,
                createdAt = u.CreatedAt
            };

            return Ok(dto);
        }


        [HttpPost("users/{id:guid}/set-role")]
        public async Task<IActionResult> SetRole(Guid id, [FromBody] SetRoleRequest req)
        {
            var me = await CurrentUserAsync();
            if (me == null) return Unauthorized();

            var isSuper = me.IsSuperAdmin(_cfg);
            var isAdmin = me.IsAdmin();
            if (!isAdmin && !isSuper) return Forbid();

            // Только SuperAdmin может назначать Admin
            if (!isSuper && req.Role == UserRole.Admin) return Forbid();

            var u = await _db.Users.FindAsync(id);
            if (u == null) return NotFound();

            var old = u.UserRole;
            u.UserRole = req.Role;

            // поддерживаем старое строковое поле
            u.Role = req.Role == UserRole.Admin ? "admin" : "investor";

            _db.ActionLogs.Add(new ActionLog
            {
                UserId = me.Id,
                Action = "SetRole",
                Details = $"User {u.Email}: {old} -> {u.UserRole}"
            });

            await _db.SaveChangesAsync();
            return Ok(new { message = "Role updated" });
        }

        [HttpPost("users/{id:guid}/set-permissions")]
        public async Task<IActionResult> SetPermissions(Guid id, [FromBody] SetPermissionsRequest req)
        {
            var me = await CurrentUserAsync();
            if (me == null) return Unauthorized();

            if (!me.IsSuperAdmin(_cfg)) return Forbid(); // только SuperAdmin

            var u = await _db.Users.FindAsync(id);
            if (u == null) return NotFound();

            var old = u.Permissions;
            u.Permissions = req.Permissions;

            _db.ActionLogs.Add(new ActionLog
            {
                UserId = me.Id,
                Action = "SetPermissions",
                Details = $"User {u.Email}: {(long)old} -> {(long)u.Permissions}"
            });

            await _db.SaveChangesAsync();
            return Ok(new { message = "Permissions updated" });
        }

        // [Authorize(Roles = "admin")]
        [HttpPost("users/{id}/force-confirm-email")]
        public async Task<IActionResult> ForceConfirmEmail(Guid id)
        {
            var u = await _db.Users.FindAsync(id);
            if (u == null) return NotFound(new { message = "User not found" });
            u.IsEmailConfirmed = true;
            _db.ActionLogs.Add(new ActionLog { UserId = id, Action = "ForceConfirmEmail", Details = "Email confirmed by admin" });
            await _db.SaveChangesAsync();
            return Ok(new { message = "Email confirmed" });
        }

        public class AdminResetPasswordRequest { public string? TempPassword { get; set; } }

        [HttpPost("users/{id}/reset-password")]
        public async Task<IActionResult> AdminResetPassword(Guid id, [FromBody] AdminResetPasswordRequest req)
        {
            var u = await _db.Users.FindAsync(id);
            if (u == null) return NotFound(new { message = "User not found" });

            var temp = string.IsNullOrWhiteSpace(req?.TempPassword)
                ? $"Tmp{Guid.NewGuid().ToString("N")[..8]}!"
                : req.TempPassword;

            u.PasswordHash = temp; // TODO: hash
            _db.ActionLogs.Add(new ActionLog { UserId = id, Action = "AdminResetPassword", Details = "Temp password set" });

            // уведомим пользователя
            await _emailService.SendEmailAsync(u.Email, "Your password was reset by admin",
                $"<p>Your temporary password: <b>{temp}</b></p><p>Please change it after login.</p>");

            await _db.SaveChangesAsync();
            return Ok(new { message = "Password reset", tempPassword = temp });
        }

        [HttpPost("users/{id}/reset-pin")]
        public async Task<IActionResult> AdminResetPin(Guid id)
        {
            var u = await _db.Users.FindAsync(id);
            if (u == null) return NotFound(new { message = "User not found" });
            u.PinCode = null;
            _db.ActionLogs.Add(new ActionLog { UserId = id, Action = "AdminResetPin", Details = "PIN cleared by admin" });
            await _db.SaveChangesAsync();
            return Ok(new { message = "PIN cleared" });
        }

       
    }

}
