using System.Text.Json;
using System.Security.Cryptography;
using System.Text;
using RealEstateInvestment.Helpers;
    using RealEstateInvestment.Models;
    using RealEstateInvestment.Data;
    using Microsoft.EntityFrameworkCore;
    //using RealEstateInvestment.Services;
    //using RealEstateInvestment.Helpers;

    namespace RealEstateInvestment.Services
    {
        public class ScheduledTaskService : BackgroundService
        {
            private readonly IServiceProvider _serviceProvider;
            private readonly IHttpClientFactory _httpClientFactory;


            public ScheduledTaskService(IServiceProvider serviceProvider, IHttpClientFactory httpClientFactory) // , IFirebaseNotificationService notificationService
            {
                _serviceProvider = serviceProvider;
                _httpClientFactory = httpClientFactory;

            }

            protected override async Task ExecuteAsync(CancellationToken stoppingToken)
            {
                while (!stoppingToken.IsCancellationRequested)
                {
                    try
                    {

                 



                        Console.WriteLine("OwnersClub 30.4.1 scheduler tick started");
                        await RunScheduledProperyStatusTask();
                        await RunExpiredShareOfferProcessing();
                        Console.WriteLine("OwnersClub 30.4.1 scheduler tick completed");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Scheduled task error: {ex.Message}");
                    }

                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); // 5 min
                }
            }

            private async Task RunExpiredShareOfferProcessing()
            {
                List<Guid> ids;
                using (var scope = _serviceProvider.CreateScope()) {
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    ids = await db.ShareOffers.AsNoTracking().Where(x => x.IsActive && x.ExpirationDate <= DateTime.UtcNow)
                        .Select(x => x.Id).ToListAsync();
                }
                foreach (var id in ids) {
                    try { await ProcessExpiredOffer(id); }
                    catch (Exception ex) when (IsFinancialConflict(ex)) {
                        Console.WriteLine($"Expiry conflict {id}; deferred to next tick: {ex.Message}");
                    }
                    catch (InvalidOperationException ex) {
                        // Preserve this offer atomically for investigation; other lots can still expire.
                        Console.WriteLine($"Expiry requires review {id}: {ex.Message}");
                    }
                }
            }

            private async Task ProcessExpiredOffer(Guid id)
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
                var offer = await db.ShareOffers.SingleOrDefaultAsync(x => x.Id == id);
                if (offer == null || !offer.IsActive || offer.ExpirationDate > DateTime.UtcNow) return;
                var seller = await db.Users.SingleAsync(x => x.Id == offer.SellerId);
                var settlement = new ShareOfferSettlement(db, scope.ServiceProvider.GetRequiredService<ISuperUserService>());
                var bids = await db.ShareOfferBids.Where(x => x.OfferId == id && x.Shares > 0 &&
                        x.Shares <= offer.SharesForSale && x.BidPricePerShare > 0 &&
                        x.BidPricePerShare >= offer.StartPricePerShare && x.BidderId != offer.SellerId)
                    .OrderByDescending(x => x.BidPricePerShare).ThenBy(x => x.CreatedAt).ThenBy(x => x.Id).ToListAsync();
                // Bids do not reserve cash. Select the best currently fundable bid, then return the unsold remainder.
                foreach (var bid in bids.Where(_ => !seller.IsBlocked && seller.IsDeleted != true && seller.IsEmailConfirmed)) {
                    var buyer = await db.Users.SingleOrDefaultAsync(x => x.Id == bid.BidderId);
                    if (buyer == null || buyer.IsBlocked || buyer.IsDeleted == true || !buyer.IsEmailConfirmed ||
                        buyer.WalletBalance < bid.Shares * bid.BidPricePerShare) continue;
                    await settlement.Settle(offer, buyer, seller, bid.Shares, bid.BidPricePerShare);
                    break;
                }
                await settlement.ReturnRemainder(offer);
                db.ActionLogs.Add(new ActionLog { UserId = seller.Id, Action = "ExpireShareOffer", Details = $"Offer={id}" });
                await db.SaveChangesAsync();
                await transaction.CommitAsync();
            }

            // One fresh context and Serializable transaction per property. No tracked state
            // from discovery or a rolled-back round may leak into another round.
            private async Task RunScheduledProperyStatusTask()
            {
                List<Guid> propertyIds;
                using (var discoveryScope = _serviceProvider.CreateScope())
                {
                    var discovery = discoveryScope.ServiceProvider.GetRequiredService<AppDbContext>();
                    propertyIds = await discovery.Properties.AsNoTracking()
                        .Where(p => p.Status != "sold" && p.Status != "declined" && p.Status != "rented")
                        .Select(p => p.Id).ToListAsync();
                }

                foreach (var propertyId in propertyIds)
                {
                    try
                    {
                        await ProcessApplicationRound(propertyId);
                    }
                    catch (Exception ex) when (IsFinancialConflict(ex))
                    {
                        // Disposal rolls back the entire round. The next scheduled tick
                        // re-reads committed state; never retry using this tracked context.
                        Console.WriteLine($"Application round conflict for {propertyId}; deferred to next tick: {ex.Message}");
                    }
                    catch (ReservationConflict ex)
                    {
                        await RecordConflict(propertyId, ex);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Application round failed for {propertyId}: {ex.GetType().Name}");
                    }
                }
            }

            private static bool IsFinancialConflict(Exception? ex) => ex != null &&
                (ex is DbUpdateConcurrencyException ||
                 ex is Npgsql.PostgresException { SqlState: "40001" or "40P01" or "23505" } ||
                 IsFinancialConflict(ex.InnerException));

            private async Task ProcessApplicationRound(Guid propertyId)
            {
                using var scope = _serviceProvider.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var notifications = new List<Message>();
                await using (var transaction = await context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable))
                {
                    var now = DateTime.UtcNow;
                    var property = await context.Properties.Include(p => p.PaymentPlans)
                        .SingleOrDefaultAsync(p => p.Id == propertyId);
                    if (property == null || property.Status == "sold" || property.Status == "declined" || property.Status == "rented") return;
                    var plans = InvestmentStages.Ordered(property.PaymentPlans);
                    var pending = await context.InvestmentApplications
                        .Where(a => a.PropertyId == property.Id && (a.Status == "pending" || a.Status == "carried"))
                        .OrderBy(a => a.Id).ToListAsync();
                    if (pending.Count == 0) return;
                    foreach (var a in pending.Where(a => a.StepNumber < 1 || a.StepNumber > plans.Count))
                        throw new ReservationConflict(a.Id, "Stage no longer exists");

                    for (var index = 0; index < plans.Count; index++)
                    {
                        var step = plans[index];
                        if (step.DueDate > now) continue;
                        var applications = pending.Where(a => a.StepNumber == index + 1).ToList();
                        if (applications.Count == 0) continue;
                        if (step.Total < 0 || step.Paid < 0)
                            throw new ReservationConflict(applications[0].Id, "Invalid stage accounting");
                        // Preflight every source before mutating any application in this property.
                        foreach (var app in applications)
                        {
                            if (!await InvestmentReservationProof.Proven(context, app))
                                throw new ReservationConflict(app.Id, "No unique matching original debit or reservation already settled");
                            if (!await context.Users.AnyAsync(u => u.Id == app.UserId))
                                throw new ReservationConflict(app.Id, "Reservation owner missing");
                        }
                        var total = applications.Sum(a => a.RequestedAmount);
                        var accepted = step.Paid + total >= step.Total;
                        foreach (var app in applications)
                        {
                            var user = await context.Users.SingleAsync(u => u.Id == app.UserId);
                            if (accepted && (user.IsBlocked || user.IsDeleted == true || !user.IsEmailConfirmed))
                                throw new ReservationConflict(app.Id, "Acceptance requires an active confirmed owner");
                            var decisionId = StableId($"scheduler3041/{step.Id}/{app.Id}");
                            if (await context.ActionLogs.AnyAsync(l => l.Id == decisionId))
                                throw new ReservationConflict(app.Id, "Terminal scheduler decision already exists");
                            if (accepted)
                            {
                                context.Investments.Add(new Investment { UserId = app.UserId, PropertyId = property.Id,
                                    Shares = app.RequestedShares, InvestedAmount = app.RequestedAmount, CreatedAt = now });
                                app.Status = "accepted"; app.ApprovedShares = app.RequestedShares; app.ApprovedAmount = app.RequestedAmount;
                            }
                            else
                            {
                                user.WalletBalance += app.RequestedAmount;
                                property.AvailableShares += app.RequestedShares;
                                if (property.AvailableShares > property.TotalShares)
                                    throw new ReservationConflict(app.Id, "Refund exceeds property capacity");
                                InvestmentLedger.Record(context, Guid.Empty, user.Id, property, app.RequestedAmount, app.RequestedShares,
                                    RealEstateInvestment.Enums.TransactionType.InvestmentRefund, "InvestmentRefund",
                                    $"scheduler/application-round; Application={app.Id}; Stage={index + 1}",
                                    operationId: StableId($"scheduler3041/refund/{app.Id}"), sourceId: app.Id);
                                app.Status = "rejected";
                                if (property.PriorityInvestorId == app.UserId) property.PriorityInvestorId = null;
                            }
                            var reason = accepted ? "Stage funding threshold reached at DueDate" : "Stage underfunded at DueDate; remaining reservation returned";
                            context.ActionLogs.Add(new ActionLog { Id = decisionId, UserId = Guid.Empty,
                                Action = "InvestmentApplicationDecision3041", Details = JsonSerializer.Serialize(new {
                                    applicationId = app.Id, Action = accepted ? "accept" : "reject", Reason = reason,
                                    ApprovedShares = accepted ? app.RequestedShares : 0, ExpectedStep = index + 1,
                                    paymentPlanId = step.Id, actor = "scheduler" }) });
                            var message = new Message { RecipientId = app.UserId,
                                Title = accepted ? "Your investment application was approved" : "Application rejected",
                                Content = $"Application {app.Id}, stage {index + 1}: {reason}." };
                            context.Messages.Add(message);
                            if (accepted) notifications.Add(message);
                        }
                        if (accepted) step.Paid += total;
                        // Never revoke prior investments, change property status or automatically carry.
                        context.ActionLogs.Add(new ActionLog { UserId = Guid.Empty,
                            Action = accepted ? "InvestmentStepAccepted" : "InvestmentStepRejected",
                            Details = $"PropertyId: {property.Id}, StepId: {step.Id}, Step: {index + 1}, Amount: {total}, Accepted: {accepted}" });
                    }
                    await context.SaveChangesAsync();
                    await transaction.CommitAsync();
                }

                // External side effects only after commit. No outbox/retry in this iteration.
                foreach (var message in notifications)
                    await SendFirebase(message.Content, message.Title, scope, context, message.RecipientId!.Value);
                // Persist notification error logs independently of the committed financial work.
                if (context.ChangeTracker.HasChanges()) await context.SaveChangesAsync();
            }

            private sealed class ReservationConflict(Guid applicationId, string reason) : InvalidOperationException(reason)
            {
                public Guid ApplicationId { get; } = applicationId;
            }

            private static Guid StableId(string value) => new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(value)).AsSpan(0, 16));

            private async Task RecordConflict(Guid propertyId, ReservationConflict error)
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var id = StableId($"scheduler3041/conflict/{error.ApplicationId}/{error.Message}");
                try
                {
                    if (await db.ActionLogs.AnyAsync(x => x.Id == id)) return;
                    db.ActionLogs.Add(new ActionLog { Id = id, UserId = Guid.Empty, Action = "InvestmentSchedulerConflict3041",
                        Details = JsonSerializer.Serialize(new { applicationId = error.ApplicationId, propertyId, reason = error.Message }) });
                    await db.SaveChangesAsync();
                }
                catch (DbUpdateException ex) when (IsFinancialConflict(ex)) { }
                Console.WriteLine($"Application reservation requires admin reconciliation: {error.ApplicationId}");
            }

            private async Task SendFirebase(string text1, string text2, IServiceScope scope, AppDbContext context, Guid userId)
            {
                try
                {
                    var notificationService = scope.ServiceProvider.GetRequiredService<IFirebaseNotificationService>();

                    var tokens = await context.FcmDeviceTokens
                        .Where(t => t.UserId == userId)
                        .Select(t => t.Token).ToListAsync();


                    foreach (var token in tokens)
                    {
                        await notificationService.SendNotificationAsync(token, text1, text2);
                    }
                }
                catch (Exception ex)
                {
                    context.ActionLogs.Add(new ActionLog
                    {
                        UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add some guid later
                        Action = "FirebaseNotificationService send error",
                        Details = ex.Message,
                    });
                }
            }
        }
    }
