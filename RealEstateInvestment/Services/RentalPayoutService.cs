using System.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Services
{
    public sealed class RentalPayoutService(
        AppDbContext _context, ISuperUserService superUserService,
        IFirebaseNotificationService notifications, ILogger<RentalPayoutService> logger)
    {
        public async Task<IActionResult> PayAsync(Guid propertyId, decimal? customAmount, Guid adminId)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var now = DateTime.UtcNow;
            var property = await _context.Properties.Include(p => p.PaymentPlans).SingleOrDefaultAsync(p => p.Id == propertyId);
            if (property == null)
                return new NotFoundObjectResult(new { message = "Property not found." });

            if (now - property.LastPayoutDate < TimeSpan.FromDays(30))
                return new ConflictObjectResult(new { message = "Payments have already been made in the last 30 days." });

            var plans = property.PaymentPlans;
            if (property.Status != "rented" || plans == null || !plans.Any(p => p.Total > 0) ||
                plans.Any(p => p.Total < 0 || p.Paid < p.Total))
                return BadRequest("Rent payout requires rented status and a completed payment plan.");

            var amount = customAmount ?? property.MonthlyRentalIncome;
            if (amount <= 0 || amount != Math.Round(amount, 2))
                return BadRequest("Enter a positive amount available for distribution, in dollars and cents.");
            if (property.TotalShares <= 0)
                return BadRequest("Property has an invalid number of shares.");

            var investments = await _context.Investments
                .Where(i => i.PropertyId == propertyId && i.Shares > 0)
                .Select(i => new { i.UserId, i.Shares }).ToListAsync();
            var offers = await _context.ShareOffers
                .Where(o => o.PropertyId == propertyId && o.IsActive && o.SharesForSale > 0)
                .Select(o => new { UserId = o.SellerId, Shares = o.SharesForSale }).ToListAsync();
            var positions = investments.Concat(offers).GroupBy(p => p.UserId)
                .Select(g => new { UserId = g.Key, Shares = g.Sum(p => (long)p.Shares) })
                .OrderBy(p => p.UserId).ToList();
            var ownedShares = positions.Sum(p => p.Shares);
            if (ownedShares == 0 || ownedShares > property.TotalShares)
                return BadRequest("Recorded ownership is missing or exceeds the number of property shares.");

            var companyId = superUserService.GetSuperUserId();
            var company = await _context.Users.FindAsync(companyId);
            if (company == null)
                return BadRequest("Company account is not configured.");

            var investorIds = positions.Select(p => p.UserId).ToList();
            var investors = await _context.Users.Where(u => investorIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id);
            if (investors.Count != investorIds.Count)
                return BadRequest("A recorded share owner has no account.");

            var referrals = (await _context.Referrals.Where(r => investorIds.Contains(r.RefereeUserId)).ToListAsync())
                .OrderBy(r => r.CreatedAt).ThenBy(r => r.Id).ToLookup(r => r.RefereeUserId);
            var feeRates = new Dictionary<Guid, decimal>();
            foreach (var investor in investors.Values.Where(u => u.Id != companyId))
            {
                var status = UserFeeHelper.GetStatus(await CalculateTotalAssets(investor));
                var (baseRate, referralRate) = UserFeeHelper.GetUserFeePercents(status);
                feeRates[investor.Id] = referrals.Contains(investor.Id) ? referralRate : baseRate;
            }

            var payouts = new Dictionary<Guid, decimal>();
            long sharesAllocated = 0;
            decimal grossAllocated = 0;
            foreach (var position in positions)
            {
                // Round the cumulative entitlement so the allocated gross never exceeds the available amount.
                sharesAllocated += position.Shares;
                var cumulativeGross = Math.Round(amount * sharesAllocated / property.TotalShares, 2);
                var gross = cumulativeGross - grossAllocated;
                grossAllocated = cumulativeGross;
                if (gross == 0) continue;

                var investor = investors[position.UserId];
                var fee = Math.Round(gross * feeRates.GetValueOrDefault(investor.Id), 2);
                var referral = referrals[investor.Id].FirstOrDefault();
                var reward = referral != null && referral.RewardValidUntil > now
                    ? Math.Round(fee * Math.Clamp(referral.ReferrerRewardPercent, 0m, 1m), 2)
                    : 0m;
                if (reward > 0)
                {
                    var inviter = await _context.Users.FindAsync(referral!.InviterUserId);
                    if (inviter == null)
                        return BadRequest("A rental referral recipient has no account.");
                    Credit(inviter, reward, TransactionType.ReferralReward);
                }
                if (fee > reward)
                    Credit(company, fee - reward, TransactionType.ClubFeeIncome);

                var net = gross - fee;
                Credit(investor, net, TransactionType.RentIncome, (int)position.Shares);
                payouts.Add(investor.Id, net);
                _context.RentalIncomes.Add(new RentalIncome
                {
                    PropertyId = propertyId, InvestorId = investor.Id, Amount = net, PayoutDate = now
                });
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = investor.Id, Action = "MonthlyRentPayout", Timestamp = now,
                    Details = FormattableString.Invariant(
                        $"User received {net:F2} USD rent for property '{property.Title}' ({propertyId}) (gross {gross:F2}, fee {fee:F2}, referral {reward:F2}).")
                });
                _context.Messages.Add(new Message
                {
                    RecipientId = investor.Id,
                    Title = $"💸 Rental income received: {net:F2} USD",
                    Content = $"You have received rent payout for property \"{property.Title}\".\nAmount: {net:F2} USD."
                });
            }

            if (payouts.Count == 0)
                return BadRequest("The amount is too small to credit any recorded share owner.");
            property.LastPayoutDate = now;
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = adminId, Action = "AdminRentPayout", Timestamp = now,
                Details = FormattableString.Invariant(
                    $"Rent for '{property.Title}' ({propertyId}): available {amount:F2} USD, allocated {grossAllocated:F2} USD, unallocated {amount - grossAllocated:F2} USD.")
            });
            var devices = await _context.FcmDeviceTokens.Where(t => investorIds.Contains(t.UserId))
                .Select(t => new { t.UserId, t.Token }).ToListAsync();
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            foreach (var device in devices)
            {
                if (!payouts.TryGetValue(device.UserId, out var net)) continue;
                try
                {
                    await notifications.SendNotificationAsync(device.Token, "💰 Rent income",
                        $"You received {net:F2} USD for \"{property.Title}\"");
                }
                catch (Exception)
                {
                    logger.LogWarning("Rent payout committed but push delivery failed for property {PropertyId}.", propertyId);
                }
            }

            return new OkObjectResult(new { message = "Payout completed" });

            void Credit(User user, decimal value, TransactionType type, int shares = 0)
            {
                user.WalletBalance += value;
                _context.UserTransactions.Add(new UserTransaction
                {
                    Id = Guid.NewGuid(), UserId = user.Id, Type = type, Amount = value, Shares = shares,
                    PropertyId = propertyId, PropertyTitle = property.Title, Timestamp = now,
                    Notes = $"{type} from rent payout for '{property.Title}'"
                });
            }
        }

        private static BadRequestObjectResult BadRequest(string message) => new(new { message });

        private async Task<decimal> CalculateTotalAssets(User user)
        {
            var userId = user.Id;

            // investments
            var totalInvested = await (
                from i in _context.Investments
                join p in _context.Properties on i.PropertyId equals p.Id
                where i.UserId == userId && i.Shares > 0
                select new
                {
                    i.Shares,
                    p.Price,
                    p.TotalShares,
                    ShareValue = p.Price / p.TotalShares
                }
            ).ToListAsync();

            decimal investmentValue = totalInvested.Sum(x => x.ShareValue * x.Shares);

            // applications
            var pendingApplications = await (
                from a in _context.InvestmentApplications
                join p in _context.Properties on a.PropertyId equals p.Id
                where a.UserId == userId && a.Status == "pending"
                select new
                {
                    a.RequestedShares,
                    ShareValue = p.Price / p.TotalShares
                }
            ).ToListAsync();

            decimal pendingApplicationsValue = pendingApplications.Sum(x => x.ShareValue * x.RequestedShares);

            // offers on market
            var marketOffers = await (
                from o in _context.ShareOffers
                join p in _context.Properties on o.PropertyId equals p.Id
                where o.SellerId == userId && o.IsActive
                select new
                {
                    o.SharesForSale,
                    ShareValue = p.Price / p.TotalShares
                }
            ).ToListAsync();

            decimal marketValue = marketOffers.Sum(x => x.ShareValue * x.SharesForSale);

            decimal wallet = user.WalletBalance;

            decimal totalAssets = wallet + investmentValue + pendingApplicationsValue + marketValue;
            return totalAssets;
        }
    }
}
