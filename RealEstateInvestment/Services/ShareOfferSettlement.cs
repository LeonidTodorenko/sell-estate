using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Services;

// Caller owns a Serializable transaction and a fresh context. No save/commit or external effects here.
internal sealed class ShareOfferSettlement(AppDbContext _context, ISuperUserService _superUserService)
{
    public async Task Settle(ShareOffer offer, User buyer, User seller, int sharesToBuy, decimal pricePerShare)
    {
        if (!offer.IsActive || sharesToBuy <= 0 || sharesToBuy > offer.SharesForSale ||
            pricePerShare <= 0 || buyer.Id == seller.Id || offer.LockedInvestedAmount < 0)
            throw new InvalidOperationException("Invalid settlement");
        var totalCost = sharesToBuy * pricePerShare;
        if (buyer.WalletBalance < totalCost) throw new InvalidOperationException("Insufficient balance");
        var property = await _context.Properties.SingleAsync(x => x.Id == offer.PropertyId);
        var buyerId = buyer.Id;
            // === 1. Покупатель платит полную цену ===
            buyer.WalletBalance -= totalCost;

            // === 2. Считаем себестоимость и прибыль продавца ===
            // При создании оффера мы посчитали LockedInvestedAmount для всех выставленных шеров
            decimal costBasis = offer.LockedInvestedAmount * sharesToBuy / offer.SharesForSale;
            decimal profit = totalCost - costBasis;

            decimal platformFee = 0m;
            decimal referralReward = 0m;
            decimal clubIncome = 0m;

            // === 3. Если прибыль > 0 — применяем клубную / реферальную комиссию ===
            if (profit > 0m)
            {
                // totalAssets продавца -> статус клуба
                decimal totalAssets = await CalculateTotalAssets(seller.Id);
                var status = UserFeeHelper.GetStatus(totalAssets);
                var (baseFeePercent, withReferralFeePercent) = UserFeeHelper.GetUserFeePercents(status);

                // реферальная связь (если продавца кто-то пригласил)
                var referral = await _context.Referrals
                    .Where(r => r.RefereeUserId == seller.Id && r.RewardValidUntil > DateTime.UtcNow)
                    .FirstOrDefaultAsync();

                bool hasReferrer = referral != null;
                decimal effectiveFeePercent = hasReferrer ? withReferralFeePercent : baseFeePercent;

                platformFee = Math.Round(profit * effectiveFeePercent, 2);
                if (platformFee < 0) platformFee = 0;

                // делим комиссию между реферером и клубом (суперпользователь)
                referralReward = 0m;
                clubIncome = platformFee;

                var superUserId = _superUserService.GetSuperUserId();
                var superUser = await _context.Users.FindAsync(superUserId);
                if (superUser == null)
                    throw new InvalidOperationException("Super user not configured");

                if (hasReferrer && referral!.ReferrerRewardPercent > 0m && platformFee > 0m)
                {
                    referralReward = Math.Round(platformFee * Math.Clamp(referral.ReferrerRewardPercent, 0m, 1m), 2);
                    clubIncome = platformFee - referralReward;
                    if (clubIncome < 0) clubIncome = 0;
                }

                // рефереру
                if (referralReward > 0m)
                {
                    var refUser = await _context.Users.FindAsync(referral!.InviterUserId);
                    if (refUser == null) throw new InvalidOperationException("Referrer not configured");
                    {
                        refUser.WalletBalance += referralReward;

                        _context.UserTransactions.Add(new UserTransaction
                        {
                            Id = Guid.NewGuid(),
                            UserId = refUser.Id,
                            Type = TransactionType.ReferralReward,
                            Amount = referralReward,
                            PropertyId = property.Id,
                            PropertyTitle = property.Title,
                            Timestamp = DateTime.UtcNow,
                            Notes = $"Offer={offer.Id}; Referral reward from share sale profit of user {seller.Email} on '{property.Title}'"
                        });
                    }
                }

                // клуб (суперпользователь)
                if (clubIncome > 0m)
                {
                    var superUserId2 = _superUserService.GetSuperUserId();
                    var superUser2 = await _context.Users.FindAsync(superUserId2);
                    if (superUser2 == null)
                        throw new InvalidOperationException("Super user not configured");

                    superUser2.WalletBalance += clubIncome;

                    _context.UserTransactions.Add(new UserTransaction
                    {
                        Id = Guid.NewGuid(),
                        UserId = superUser2.Id,
                        Type = TransactionType.ClubFeeIncome,
                        Amount = clubIncome,
                        PropertyId = property.Id,
                        PropertyTitle = property.Title,
                        Timestamp = DateTime.UtcNow,
                        Notes = $"Offer={offer.Id}; Club fee from share sale profit of user {seller.Email} on '{property.Title}'"
                    });
                }
            }

            // === 4. Продавец получает сумму после вычета комиссии ===
            decimal sellerReceives = totalCost - platformFee;
            seller.WalletBalance += sellerReceives;

            // Consume only the shares and basis actually sold.
            offer.SharesForSale -= sharesToBuy;
            offer.LockedInvestedAmount -= costBasis;
            offer.IsActive = offer.SharesForSale > 0;

            // === 6. Добавляем покупателю инвестицию ===
            var buyerInvestment = await _context.Investments
                .FirstOrDefaultAsync(i => i.UserId == buyerId && i.PropertyId == offer.PropertyId);

            if (buyerInvestment == null)
            {
                buyerInvestment = new Investment
                {
                    Id = Guid.NewGuid(),
                    UserId = buyerId,
                    PropertyId = offer.PropertyId,
                    Shares = sharesToBuy,
                    InvestedAmount = totalCost,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Investments.Add(buyerInvestment);
            }
            else
            {
                buyerInvestment.Shares += sharesToBuy;
                buyerInvestment.InvestedAmount += totalCost;
            }

            // === 7. Trade history ===
            _context.ShareTransactions.Add(new ShareTransaction
            {
                BuyerId = buyer.Id,
                SellerId = seller.Id,
                PropertyId = offer.PropertyId,
                Shares = sharesToBuy,
                PricePerShare = pricePerShare,
                Timestamp = DateTime.UtcNow
            });

            // === 8. Сообщения и UserTransactions (как раньше, только Notes чуть богаче) ===
            _context.Messages.Add(new Message
            {
                RecipientId = seller.Id,
                Title = "Your shares were sold",
                Content = $"{sharesToBuy} shares of \"{property.Title}\" were sold. Sum: {totalCost:F2} USD. " +
                          $"Net after fees: {sellerReceives:F2} USD."
            });

            _context.UserTransactions.Add(new UserTransaction
            {
                Id = Guid.NewGuid(),
                UserId = seller.Id,
                Type = TransactionType.ShareMarketSell,
                Amount = totalCost, // полная сумма сделки
                Shares = sharesToBuy,
                PropertyId = property.Id,
                PropertyTitle = property.Title,
                Timestamp = DateTime.UtcNow,
                Notes = $"Offer={offer.Id}; Share market sell. CostBasis={costBasis}, Profit={profit}, PlatformFee={platformFee}"
            });

            _context.UserTransactions.Add(new UserTransaction
            {
                Id = Guid.NewGuid(),
                UserId = buyer.Id,
                Type = TransactionType.ShareMarketBuy,
                Amount = totalCost,
                Shares = sharesToBuy,
                PropertyId = property.Id,
                PropertyTitle = property.Title,
                Timestamp = DateTime.UtcNow,
                Notes = $"Offer={offer.Id}; Share market buy"
            });

            if (platformFee > 0m)
                _context.UserTransactions.Add(new UserTransaction {
                    Id = Guid.NewGuid(), UserId = seller.Id, Type = TransactionType.ShareMarketFee,
                    Amount = platformFee, PropertyId = property.Id, PropertyTitle = property.Title,
                    Timestamp = DateTime.UtcNow, Notes = $"Share market fee; Offer={offer.Id}"
                });

            // уведомления участникам торгов (оставляем как было)
            var bidParticipants = await _context.ShareOfferBids
                .Where(b => b.OfferId == offer.Id && b.BidderId != buyer.Id)
                .Select(b => b.BidderId)
                .Distinct()
                .ToListAsync();

            foreach (var bidderId in bidParticipants)
            {
                _context.Messages.Add(new Message
                {
                    RecipientId = bidderId,
                    Title = "Lot is sold",
                    Content = $"Lot \"{property.Title}\", the item you bid on was sold to another user."
                });
            }

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = buyerId,
                Action = "BuyShare",
                Details = $"Offer={offer.Id}, Shares={sharesToBuy}, Total={totalCost:F2}, Profit={profit:F2}, Fee={platformFee:F2}"
            });


    }

    public async Task ReturnRemainder(ShareOffer offer)
    {
        if (offer.SharesForSale < 0 || offer.LockedInvestedAmount < 0 ||
            (offer.SharesForSale == 0 && offer.LockedInvestedAmount != 0))
            throw new InvalidOperationException("Invalid locked ownership");
        if (offer.SharesForSale > 0)
        {
            var investment = await _context.Investments.Where(x => x.UserId == offer.SellerId && x.PropertyId == offer.PropertyId)
                .OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).FirstOrDefaultAsync();
            if (investment == null) {
                investment = new Investment { Id = Guid.NewGuid(), UserId = offer.SellerId, PropertyId = offer.PropertyId, CreatedAt = DateTime.UtcNow };
                _context.Investments.Add(investment);
            }
            investment.Shares += offer.SharesForSale;
            investment.InvestedAmount += offer.LockedInvestedAmount;
        }
        offer.SharesForSale = 0;
        offer.LockedInvestedAmount = 0;
        offer.IsActive = false;
    }
        private async Task<decimal> CalculateTotalAssets(Guid userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return 0m;

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

            // pending applications
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
