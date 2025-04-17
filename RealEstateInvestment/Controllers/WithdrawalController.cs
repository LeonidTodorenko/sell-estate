using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
 
namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/withdrawals")]
    public class WithdrawalController : ControllerBase
    {
        private readonly AppDbContext _context;

        public WithdrawalController(AppDbContext context)
        {
            _context = context;
        }

        // The investor submits a request for withdrawal of funds
        [HttpPost("request")]
        public async Task<IActionResult> RequestWithdrawal([FromBody] WithdrawalRequest request)
        {
            var user = await _context.Users.FindAsync(request.UserId);
            if (user == null) return NotFound(new { message = "User not found" });

            if (request.Amount <= 0 || request.Amount > user.WalletBalance)
                return BadRequest(new { message = "Insufficient funds" });

            user.WalletBalance -= request.Amount;
            _context.WithdrawalRequests.Add(request);
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = user.Id,
                Action = "RequestWithdrawal",
                Details = "New request withdrawal amount: " + request.Amount
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Withdrawal request submitted" });
        }

        // administrator confirms the conclusion
        [HttpPost("{id}/approve")]
        public async Task<IActionResult> ApproveWithdrawal(Guid id)
        {
            var request = await _context.WithdrawalRequests.FindAsync(id);
            if (request == null) return NotFound(new { message = "Application not found" });

            request.Status = "approved";
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                Action = "ApproveWithdrawal",
                Details = "Request approved on id:" + id.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Conclusion approved" });
        }

        //  administrator rejects the withdrawal.
        [HttpPost("{id}/reject")]
        public async Task<IActionResult> RejectWithdrawal(Guid id)
        {
            var request = await _context.WithdrawalRequests.FindAsync(id);
            if (request == null) return NotFound(new { message = "Application not found" });

            var user = await _context.Users.FindAsync(request.UserId);
            if (user != null)
            {
                user.WalletBalance += request.Amount; // Возвращаем деньги
            }

            request.Status = "rejected";
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                Action = "RejectWithdrawal",
                Details = "Request rejected on id:" + id.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Conclusion rejected" });
        }

        // Investor application history
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserWithdrawals(Guid userId)
        {
            var withdrawals = await _context.WithdrawalRequests
                .Where(w => w.UserId == userId)
                .OrderByDescending(w => w.CreatedAt)
                .ToListAsync();

            return Ok(withdrawals);
        }

        [HttpGet("all")]
        public async Task<IActionResult> GetAllWithdrawals()
        {
            var all = await _context.WithdrawalRequests
                .OrderByDescending(w => w.CreatedAt)
                .ToListAsync();

            return Ok(all);
        }
    }
}
