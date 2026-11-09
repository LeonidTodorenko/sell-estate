using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;

namespace RealEstateInvestment.Controllers;

[ApiController, Authorize, FinancialConcurrency]
[Route("api/investment-workflow")]
public sealed class InvestmentWorkflowController(AppDbContext db) : ControllerBase
{
    [HttpGet("properties/{id:guid}")]
    public async Task<IActionResult> Stages(Guid id)
    {
        var p = await db.Properties.AsNoTracking().Include(x => x.PaymentPlans).SingleOrDefaultAsync(x => x.Id == id);
        if (p == null) return NotFound();
        var plans = InvestmentStages.Ordered(p.PaymentPlans);
        var now = DateTime.UtcNow;
        var active = InvestmentStages.Active(plans, now);
        var accounting = active ?? plans.LastOrDefault();
        var open = plans.Count > 0 && p.Price > 0 && p.TotalShares > 0 && p.AvailableShares > 0 &&
            p.Status is not ("sold" or "declined" or "rented") && !(now < plans[0].EventDate);
        var automatic = HttpContext.RequestServices.GetRequiredService<IConfiguration>().GetValue<bool>(BackgroundJobRegistration.EnabledSetting);
        return Ok(new { propertyId = id, p.AvailableShares, p.TotalShares,
            pricePerShare = p.TotalShares > 0 ? p.Price / p.TotalShares : 0,
            serverTime = now, canApply = open, currentStep = accounting == null ? (int?)null : plans.IndexOf(accounting) + 1,
            mode = active != null && active.Id == plans[0].Id ? "reservation" : "direct",
            processing = automatic ? "scheduled" : "manual", automaticProcessingEnabled = automatic,
            terms = "Full share price is debited once. First-stage applications reserve shares pending a decision. Later purchases create investments immediately. Percentages describe the property schedule, not an installment discount. Rejection returns the reservation; partial acceptance returns its unused amount. At DueDate the scheduler accepts a funded queue or returns underfunded pending/carried reservations. Existing investments and property status are preserved. Carry is an administrator decision. Unproven reservations require reconciliation.",
            stages = plans.Select((s, i) => new { s.Id, stepNumber = i + 1, s.Milestone, s.EventDate, s.DueDate,
                s.Percentage, s.Total, s.Paid, s.Outstanding, available = open && s.Id == accounting?.Id }) });
    }

    [HttpGet("applications/{id:guid}/history")]
    public async Task<IActionResult> History(Guid id)
    {
        var app = await db.InvestmentApplications.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id);
        if (app == null) return NotFound();
        if (await PrivateDataAccess.RequireOwnerAsync(User, db, app.UserId,
            HttpContext.RequestServices.GetRequiredService<IConfiguration>(), allowAdmin: true) is { } error) return error;
        var marker = $"\"applicationId\":\"{id}\"";
        var history = await db.ActionLogs.AsNoTracking().Where(x => (x.Action == "InvestmentApplicationDecision304" || x.Action == "InvestmentApplicationDecision3041" || x.Action == "InvestmentSchedulerConflict3041") && x.Details.Contains(marker))
            .OrderBy(x => x.Timestamp).Select(x => new { x.Timestamp, x.Details }).ToListAsync();
        return Ok(new { app.Id, app.Status, app.StepNumber, app.CreatedAt, history });
    }

    [HttpGet("scheduler-conflicts"), FinancialAdmin]
    public async Task<IActionResult> Conflicts() => Ok(await db.ActionLogs.AsNoTracking()
        .Where(x => x.Action == "InvestmentSchedulerConflict3041").OrderByDescending(x => x.Timestamp)
        .Take(200).Select(x => new { x.Id, x.Timestamp, x.Details }).ToListAsync());

    public sealed class Decision
    {
        public Guid OperationId { get; set; }
        [Required] public string Action { get; set; } = "";
        [Required, StringLength(1000, MinimumLength = 3)] public string Reason { get; set; } = "";
        public int ApprovedShares { get; set; }
        public int ExpectedStep { get; set; }
        public Guid[]? ExpectedRound { get; set; }
    }

    [HttpPost("applications/{id:guid}/decision"), FinancialAdmin]
    public async Task<IActionResult> Decide(Guid id, Decision r)
    {
        if (r.OperationId == Guid.Empty || r.Action is not ("accept" or "accept-stage" or "reject" or "carry") ||
            string.IsNullOrWhiteSpace(r.Reason) || r.Reason.Trim().Length < 3 || r.ExpectedStep <= 0)
            return BadRequest(new { message = "Provide an operation UUID, action, current stage and reason." });
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        // A stable audit UUID provides durable recovery, including carry (which moves the stage).
        var prior = await db.ActionLogs.AsNoTracking().SingleOrDefaultAsync(x => x.Id == r.OperationId);
        var request = JsonSerializer.Serialize(new { applicationId = id, r.Action, r.Reason, r.ApprovedShares, r.ExpectedStep,
            expectedRound = r.ExpectedRound?.OrderBy(x => x).ToArray() });
        if (prior != null) return prior.Action == "InvestmentApplicationDecision304" && prior.Details == request && prior.UserId == User.GetUserId()
            ? Ok(new { message = "Decision committed" }) : Conflict(new { message = "Operation UUID already used." });
        var a = await db.InvestmentApplications.SingleOrDefaultAsync(x => x.Id == id);
        if (a == null) return NotFound();
        if (a.Status is not ("pending" or "carried") || a.StepNumber != r.ExpectedStep)
            return Conflict(new { message = "Application changed; reload its current status and stage." });
        var p = await db.Properties.Include(x => x.PaymentPlans).SingleAsync(x => x.Id == a.PropertyId);
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == a.UserId);
        if (user == null || a.RequestedShares <= 0 || a.RequestedAmount <= 0)
            return Conflict(new { message = "Reservation requires reconciliation." });
        // Never refund or allocate an unproven legacy reservation. Original debit stays immutable.
        if (!await Proven(a)) return Conflict(new { message = "No matching original debit; manual reconciliation required." });
        var plans = InvestmentStages.Ordered(p.PaymentPlans);
        if (a.StepNumber > plans.Count) return Conflict(new { message = "Stage no longer exists." });
        var stage = plans[a.StepNumber - 1];
        if (r.Action != "accept" && r.ApprovedShares != 0) return BadRequest();
        if (r.Action == "accept-stage")
        {
            // Preserve the existing all-reservations funding rule, with one atomic manual round.
            // Individual partial decisions cannot leave a partly funded stage below its minimum.
            var round = await db.InvestmentApplications.Where(x => x.PropertyId == p.Id && x.StepNumber == a.StepNumber &&
                (x.Status == "pending" || x.Status == "carried")).OrderBy(x => x.Id).ToListAsync();
            if (r.ExpectedRound == null || !round.Select(x => x.Id).OrderBy(x => x).SequenceEqual(r.ExpectedRound.OrderBy(x => x)))
                return Conflict(new { message = "The stage queue changed. Reload and review all reservations before accepting the round." });
            var total = round.Sum(x => x.RequestedAmount);
            if (stage.Paid + total < stage.Total || p.Status is "sold" or "declined" or "rented")
                return Conflict(new { message = "The stage funding threshold is not covered." });
            foreach (var entry in round)
            {
                var owner = await db.Users.SingleOrDefaultAsync(x => x.Id == entry.UserId);
                if (owner == null || owner.IsBlocked || owner.IsDeleted == true || !owner.IsEmailConfirmed ||
                    entry.RequestedAmount <= 0 || entry.RequestedShares <= 0 || !await Proven(entry))
                    return Conflict(new { message = "Every reservation in the round must have an active owner and matching original debit." });
                db.Investments.Add(new Investment { UserId = entry.UserId, PropertyId = entry.PropertyId,
                    Shares = entry.RequestedShares, InvestedAmount = entry.RequestedAmount });
                entry.Status = "accepted"; entry.ApprovedShares = entry.RequestedShares; entry.ApprovedAmount = entry.RequestedAmount;
                db.ActionLogs.Add(new ActionLog { Id = entry.Id == id ? r.OperationId : Guid.NewGuid(), UserId = User.GetUserId(),
                    Action = "InvestmentApplicationDecision304", Details = entry.Id == id ? request : JsonSerializer.Serialize(new {
                        applicationId = entry.Id, r.Action, r.Reason, ApprovedShares = entry.RequestedShares, r.ExpectedStep, roundOperationId = r.OperationId }) });
                db.Messages.Add(new Message { RecipientId = entry.UserId, Title = "Investment stage accepted",
                    Content = $"Application {entry.Id}: accepted. {entry.RequestedShares} shares. Reason: {r.Reason.Trim()}" });
            }
            stage.Paid += total;
            await db.SaveChangesAsync(); await tx.CommitAsync();
            return Ok(new { message = "Decision committed", applications = round.Count, amount = total });
        }
        if (r.Action == "carry")
        {
            if (a.StepNumber == plans.Count || p.Status is "sold" or "declined" or "rented") return Conflict(new { message = "No next available stage." });
            a.StepNumber++; a.Status = "carried"; // Same reservation and source; no second debit, refund or allocation.
        }
        else
        {
            var shares = r.Action == "reject" ? 0 : r.ApprovedShares;
            if (shares < 0 || shares > a.RequestedShares || (r.Action == "accept" && shares == 0)) return BadRequest();
            // Allocate from the original reservation, never from today's changed property price.
            var amount = shares == a.RequestedShares ? a.RequestedAmount : decimal.Round(a.RequestedAmount * shares / a.RequestedShares, 2, MidpointRounding.ToEven);
            if (shares > 0 && (amount <= 0 || amount > a.RequestedAmount || p.Status is "sold" or "declined" or "rented" || (user.IsBlocked || user.IsDeleted == true || !user.IsEmailConfirmed) ||
                stage.Paid + amount < stage.Total))
                return Conflict(new { message = "Acceptance must cover the stage funding threshold and requires an active investor/property. Use carry or reject otherwise." });
            var refund = a.RequestedAmount - amount;
            if (refund > 0)
            {
                user.WalletBalance += refund; p.AvailableShares += a.RequestedShares - shares;
                InvestmentLedger.Record(db, User.GetUserId(), a.UserId, p, refund, a.RequestedShares - shares,
                    TransactionType.InvestmentRefund, "InvestmentApplicationRefund304", $"Application={id}; Decision={r.OperationId}", sourceId: id);
            }
            if (shares > 0)
            {
                db.Investments.Add(new Investment { UserId = a.UserId, PropertyId = a.PropertyId, Shares = shares, InvestedAmount = amount });
                stage.Paid += amount;
            }
            a.ApprovedShares = shares; a.ApprovedAmount = amount;
            a.Status = shares == 0 ? "rejected" : shares == a.RequestedShares ? "accepted" : "partial";
            if (p.PriorityInvestorId == a.UserId && shares < a.RequestedShares) p.PriorityInvestorId = null;
        }
        db.ActionLogs.Add(new ActionLog { Id = r.OperationId, UserId = User.GetUserId(), Action = "InvestmentApplicationDecision304", Details = request });
        db.Messages.Add(new Message { RecipientId = a.UserId, Title = "Investment application updated",
            Content = $"Application {id}: {a.Status}, stage {a.StepNumber}. Reason: {r.Reason.Trim()}" });
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return Ok(new { message = "Decision committed", a.Status, a.StepNumber, a.ApprovedShares, a.ApprovedAmount });
    }

    private Task<bool> Proven(InvestmentApplication a) => InvestmentReservationProof.Proven(db, a);
}
