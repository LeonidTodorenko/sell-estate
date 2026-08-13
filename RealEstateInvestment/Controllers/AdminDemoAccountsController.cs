using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Dtos;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services.Demo;

namespace RealEstateInvestment.Controllers;

[ApiController]
[Authorize]
[Route("api/admin/demo-accounts")]
public sealed class AdminDemoAccountsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly IDemoAccountFactory _factory;

    public AdminDemoAccountsController(
        AppDbContext db,
        IConfiguration configuration,
        IDemoAccountFactory factory) =>
        (_db, _configuration, _factory) = (db, configuration, factory);

    [HttpGet]
    [ProducesResponseType(typeof(List<AdminDemoAccountDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        if (!await IsAdminAsync(cancellationToken)) return Forbid();

        var accounts = await _db.DemoUsers.AsNoTracking()
            .OrderByDescending(x => x.IsTemplate)
            .ThenByDescending(x => x.CreatedAt)
            .Select(x => ToDto(x))
            .ToListAsync(cancellationToken);
        return Ok(accounts);
    }

    [HttpPost]
    [ProducesResponseType(typeof(AdminDemoAccountDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] AdminCreateDemoAccountRequest request,
        CancellationToken cancellationToken)
    {
        if (!await IsAdminAsync(cancellationToken)) return Forbid();
        if (request.ExpiresAt is { } expiresAt && expiresAt <= DateTime.UtcNow)
            return BadRequest(new { message = "ExpiresAt must be in the future." });

        try
        {
            var account = await _factory.CreateFromTemplateAsync(new CreateDemoAccountRequest(
                request.FullName, request.Email, request.Password, request.DemoCode, request.ExpiresAt), cancellationToken);
            return Created("/api/admin/demo-accounts", ToDto(account));
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("already exists", StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "A demo account with the same email, code, or client number already exists." });
        }
    }

    [HttpPost("{id:guid}/reset")]
    [ProducesResponseType(typeof(AdminDemoAccountDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Reset(Guid id, CancellationToken cancellationToken)
    {
        if (!await IsAdminAsync(cancellationToken)) return Forbid();
        try
        {
            return Ok(ToDto(await _factory.ResetFromTemplateAsync(id, cancellationToken)));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}/active")]
    [ProducesResponseType(typeof(AdminDemoAccountDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> SetActive(
        Guid id,
        [FromBody] AdminSetDemoAccountActiveRequest request,
        CancellationToken cancellationToken)
    {
        if (!await IsAdminAsync(cancellationToken)) return Forbid();
        var account = await _db.DemoUsers.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (account is null) return NotFound(new { message = "Demo account was not found." });
        if (account.IsTemplate && !request.IsActive)
            return BadRequest(new { message = "The demo template cannot be deactivated." });

        account.IsActive = request.IsActive;
        _db.DemoActionLogs.Add(new DemoActionLog
        {
            DemoUserId = account.Id,
            Action = request.IsActive ? "DemoAccountActivated" : "DemoAccountDeactivated",
            Details = "Status changed by an administrator.",
            Timestamp = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(account));
    }

    private async Task<bool> IsAdminAsync(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var user = await _db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);
        return user is not null && (user.IsAdmin() || user.IsSuperAdmin(_configuration));
    }

    private static AdminDemoAccountDto ToDto(DemoUser account) => new()
    {
        Id = account.Id,
        DemoCode = account.DemoCode,
        FullName = account.FullName,
        Email = account.Email,
        WalletBalance = account.WalletBalance,
        IsTemplate = account.IsTemplate,
        IsActive = account.IsActive,
        CreatedAt = account.CreatedAt,
        LastActiveAt = account.LastActiveAt,
        ExpiresAt = account.ExpiresAt
    };
}
