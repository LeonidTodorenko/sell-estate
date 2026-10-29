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

                 



                        //todo отключили пока
                        await RunScheduledProperyStatusTask();
                        await RunExpiredShareOfferProcessing();
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
                        .Where(p => p.Status != "sold" && p.Status != "declined")
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
                }
            }

            private static bool IsFinancialConflict(Exception? ex) => ex != null &&
                (ex is DbUpdateConcurrencyException ||
                 ex is Npgsql.PostgresException { SqlState: "40001" or "40P01" } ||
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
                    if (property == null || property.Status == "sold" || property.Status == "declined") return;
                    if (property.PaymentPlans == null || property.PaymentPlans.Count == 0) return;

                    var step = property.PaymentPlans.Where(p => p.DueDate <= now && p.Paid == 0)
                        .OrderBy(p => p.DueDate).ThenBy(p => p.Id).FirstOrDefault();
                    if (step == null) return;

                    // Preserve Min(EventDate): nulls are ignored if a dated step exists.
                    // Resolve equal/all-null dates by DueDate and Id so only ONE step is first.
                    var minEventDate = property.PaymentPlans.Min(p => p.EventDate);
                    var firstStep = property.PaymentPlans.Where(p => p.EventDate == minEventDate)
                        .OrderBy(p => p.DueDate).ThenBy(p => p.Id).First();
                    if (step.Id != firstStep.Id) return;

                    var applications = await context.InvestmentApplications
                        .Where(a => a.PropertyId == property.Id && a.Status == "pending")
                        .OrderByDescending(a => a.IsPriority).ThenBy(a => a.CreatedAt).ToListAsync();
                    if (applications.Count == 0) return;

                    var totalRequested = applications.Sum(a => a.RequestedAmount);
                    var accepted = totalRequested >= step.Total;
                    foreach (var app in applications)
                    {
                        var user = await context.Users.FindAsync(app.UserId);
                        // Never commit a partially processed round with an orphan reservation.
                        if (user == null) throw new InvalidOperationException($"Application {app.Id} has no user.");
                        Message message;
                        if (accepted)
                        {
                            // Total is a minimum threshold. Accept ALL pending reservations;
                            // wallet and shares were already reserved by /investments/apply.
                            context.Investments.Add(new Investment
                            {
                                UserId = app.UserId, PropertyId = app.PropertyId,
                                Shares = app.RequestedShares, InvestedAmount = app.RequestedAmount, CreatedAt = now
                            });
                            app.Status = "accepted";
                            app.ApprovedShares = app.RequestedShares;
                            app.ApprovedAmount = app.RequestedAmount;
                            message = new Message
                            {
                                Title = "Your investment application was approved",
                                Content = $"You were allocated {app.RequestedShares} shares for property {property.Title}.",
                                RecipientId = app.UserId
                            };
                            notifications.Add(message);
                        }
                        else
                        {
                            user.WalletBalance += app.RequestedAmount;
                            context.UserTransactions.Add(new UserTransaction {
                                Id = Guid.NewGuid(), UserId = user.Id,
                                Type = RealEstateInvestment.Enums.TransactionType.InvestmentRefund,
                                Amount = app.RequestedAmount, Shares = app.RequestedShares,
                                PropertyId = property.Id, PropertyTitle = property.Title, Timestamp = now,
                                Notes = $"Rejected application refund; Application={app.Id}"
                            });
                            property.AvailableShares += app.RequestedShares;
                            property.Status = "declined";
                            property.PriorityInvestorId = null;
                            app.Status = "rejected";
                            message = new Message
                            {
                                Title = "Application rejected",
                                Content = $"Your application for property {property.Title} was rejected due to insufficient funding.",
                                RecipientId = app.UserId
                            };
                        }
                        context.Messages.Add(message);
                    }
                    if (accepted) step.Paid = totalRequested;
                    context.ActionLogs.Add(new ActionLog
                    {
                        UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"),
                        Action = accepted ? "InvestmentStepAccepted" : "InvestmentStepRejected",
                        Details = $"PropertyId: {property.Id}, Step DueDate: {step.DueDate}, Accepted: {accepted}"
                    });
                    await context.SaveChangesAsync();
                    await transaction.CommitAsync();
                }

                // External side effects only after commit. No outbox/retry in this iteration.
                foreach (var message in notifications)
                    await SendFirebase(message.Content, message.Title, scope, context, message.RecipientId!.Value);
                // Persist notification error logs independently of the committed financial work.
                if (context.ChangeTracker.HasChanges()) await context.SaveChangesAsync();
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
