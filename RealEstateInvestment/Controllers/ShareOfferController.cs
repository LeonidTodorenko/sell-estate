using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Org.BouncyCastle.Asn1.Ocsp;
using Org.BouncyCastle.Ocsp;
using Org.BouncyCastle.Utilities;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/share-offers")]
    public class ShareOfferController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ISuperUserService _superUserService;

        public ShareOfferController(ISuperUserService superUserService, AppDbContext context)
        {
            _context = context;
            _superUserService = superUserService;
        }

        //  Добавить новое предложение
        [HttpPost]
        public async Task<IActionResult> CreateOffer([FromBody] CreateShareOfferRequest request)
        {
            if (User.IsDemo()) return await CreateDemoOffer(request);

            var seller = await _context.Users.FindAsync(request.SellerId);

            if (seller == null)
                return BadRequest("Seller not found");

            if (!string.IsNullOrEmpty(seller.PinCode))
            {
                if (request.PinOrPassword != seller.PinCode &&
                    request.PinOrPassword != seller.PasswordHash)
                    return BadRequest("Invalid PIN");
            }
            else
            {
                if (request.PinOrPassword != seller.PasswordHash)
                    return BadRequest("Invalid password");
            }

            var investments = await _context.Investments
                .Where(i => i.UserId == request.SellerId && i.PropertyId == request.PropertyId)
                .OrderBy(i => i.CreatedAt)
                .ToListAsync();

            var totalShares = investments.Sum(i => i.Shares);
            if (totalShares < request.SharesForSale)
                return BadRequest("Not enough shares to sell");

            int remaining = request.SharesForSale;
            decimal lockedAmount = 0;

            foreach (var inv in investments)
            {
                if (remaining == 0) break;
                int deduct = Math.Min(inv.Shares, remaining);
                decimal pricePerShare = inv.Shares == 0 ? 0 : inv.InvestedAmount / inv.Shares;
                inv.Shares -= deduct;
                inv.InvestedAmount -= pricePerShare * deduct;
                lockedAmount += pricePerShare * deduct;
                remaining -= deduct;
            }

            var offer = new ShareOffer
            {
                Id = Guid.NewGuid(),
                SellerId = request.SellerId,
                PropertyId = request.PropertyId,
                SharesForSale = request.SharesForSale,
                StartPricePerShare = request.StartPricePerShare,
                BuyoutPricePerShare = request.BuyoutPricePerShare,
                ExpirationDate = request.ExpirationDate,
                CreatedAt = DateTime.UtcNow,
                IsActive = true,
                LockedInvestedAmount = lockedAmount
            };

            _context.ShareOffers.Add(offer);
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = request.SellerId,
                Action = "CreateOffer",
                Details = $"Seller: {request.SellerId}, Property: {request.PropertyId}, Shares: {request.SharesForSale}, Locked: {lockedAmount}"
            });
            await _context.SaveChangesAsync();

            return Ok(offer);
        }

        public class CreateShareOfferRequest
        {
            public Guid SellerId { get; set; }
            public Guid PropertyId { get; set; }
            public int SharesForSale { get; set; }
            public decimal StartPricePerShare { get; set; }
            public decimal? BuyoutPricePerShare { get; set; }
            public DateTime ExpirationDate { get; set; }
            public string PinOrPassword { get; set; } = string.Empty;
        }

        [HttpGet("user/{id}/grouped")]
        public async Task<IActionResult> GetGroupedInvestments(Guid id)
        {
            if (User.IsDemo()) return await GetDemoGroupedInvestments();
            try
            {
                var grouped = await _context.Investments
                  .Where(i => i.UserId == id && i.Shares > 0)
                  .GroupBy(i => i.PropertyId)
                  .Select(g => new
                  {
                      PropertyId = g.Key,
                      Shares = g.Sum(i => i.Shares),
                      TotalInvested = g.Sum(i => i.InvestedAmount),
                      averagePrice = g.Sum(i => i.Shares) == 0 ? 0 : g.Sum(i => i.InvestedAmount) / g.Sum(i => i.Shares),
                      PropertyTitle = g.Select(i => i.Property.Title).FirstOrDefault(),
                      BuybackPricePerShare = g.Select(i => i.Property.BuybackPricePerShare).FirstOrDefault()
                  })
                  .ToListAsync();
                return Ok(grouped);
            }
            catch (Exception ex)
            {
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = id,
                    Action = "GetGroupedInvestments error",
                    Details = ex.Message,
                });
                await _context.SaveChangesAsync();
                return BadRequest(ex);
            }

        }

        [HttpGet("active")]
        public async Task<IActionResult> GetActiveOffers()
        {
            if (User.IsDemo()) return await GetDemoActiveOffers();
            var offers = await _context.ShareOffers
                .Where(o => o.IsActive && o.ExpirationDate > DateTime.UtcNow)
                .Include(o => o.Property)
                .Select(o => new
                {
                    o.Id,
                    o.SellerId,
                    o.PropertyId,
                    o.SharesForSale,
                    // o.PricePerShare,
                    o.BuyoutPricePerShare,
                    o.StartPricePerShare,
                    o.ExpirationDate,
                    o.IsActive,
                    o.CreatedAt,
                    PropertyTitle = o.Property.Title
                })
                .ToListAsync();

            return Ok(offers);
        }

        [HttpGet("user/{userId}/active")]
        public async Task<IActionResult> GetUserActiveOffers(Guid userId)
        {
            if (User.IsDemo()) return await GetDemoUserActiveOffers();
            var offers = await _context.ShareOffers
                .Where(o => o.SellerId == userId && o.IsActive && o.ExpirationDate > DateTime.UtcNow)
                .Select(o => new
                {
                    //   o.PricePerShare,
                    o.BuyoutPricePerShare,
                    o.StartPricePerShare,
                    o.ExpirationDate
                })
                .ToListAsync();

            return Ok(offers);
        }

        [HttpPost("sell-to-platform")]
        public async Task<IActionResult> SellToPlatform([FromBody] SellToPlatformRequest request)
        {
            if (User.IsDemo())
                return BadRequest(new { message = "Platform buyback is disabled in demo mode because no isolated demo platform wallet/ownership account exists" });
            var investments = await _context.Investments
                .Include(i => i.Property)
                .Include(i => i.User)
                .Where(i => i.UserId == request.UserId && i.PropertyId == request.PropertyId && i.Shares > 0)
                .ToListAsync();

            if (!investments.Any())
                return BadRequest("No investments found for this property");

            var property = investments.First().Property;
            var user = investments.First().User;

            if (!string.IsNullOrEmpty(user.PinCode))
            {
                if (request.PinOrPassword != user.PinCode &&
                    request.PinOrPassword != user.PasswordHash)
                    return BadRequest("Invalid PIN");
            }
            else
            {
                if (request.PinOrPassword != user.PasswordHash)
                    return BadRequest("Invalid password");
            }

            if (property.BuybackPricePerShare == null)
                return BadRequest("No buyback price available");

            var pricePerShare = property.BuybackPricePerShare.Value;
            var totalSharesToSell = investments.Sum(i => i.Shares);
            var amount = pricePerShare * totalSharesToSell;

            var superUserId = _superUserService.GetSuperUserId();
            var superUser = await _context.Users.FindAsync(superUserId);
            if (superUser == null)
                return BadRequest("Super user not found");

            if (superUser.WalletBalance < amount)
                return BadRequest("Platform has insufficient funds");

            int remainingShares = totalSharesToSell;
            decimal totalInvestedRemoved = 0;

            foreach (var investment in investments.ToList())
            {
                int sharesToRemove = Math.Min(remainingShares, investment.Shares);
                decimal investedPortion = (investment.InvestedAmount / investment.Shares) * sharesToRemove;

                investment.Shares -= sharesToRemove;
                investment.InvestedAmount -= investedPortion;
                totalInvestedRemoved += investedPortion;

                remainingShares -= sharesToRemove;

                if (investment.Shares == 0)
                    _context.Investments.Remove(investment);

                if (remainingShares == 0)
                    break;
            }

            user.WalletBalance += amount;
            superUser.WalletBalance -= amount;

            var superUserInvestment = await _context.Investments
                .FirstOrDefaultAsync(i => i.UserId == superUserId && i.PropertyId == property.Id);

            if (superUserInvestment == null)
            {
                _context.Investments.Add(new Investment
                {
                    Id = Guid.NewGuid(),
                    UserId = superUserId,
                    PropertyId = property.Id,
                    Shares = totalSharesToSell,
                    InvestedAmount = amount,
                    CreatedAt = DateTime.UtcNow
                });
            }
            else
            {
                superUserInvestment.Shares += totalSharesToSell;
                superUserInvestment.InvestedAmount += amount;
            }

            _context.UserTransactions.Add(new UserTransaction
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                Type = TransactionType.Buyback,
                Amount = amount,
                Shares = totalSharesToSell,
                PropertyId = property.Id,
                PropertyTitle = property.Title,
                Timestamp = DateTime.UtcNow,
                Notes = "Sell to platform"
            });

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = request.UserId,
                Action = "SellToPlatform",
                Details = $"Sold {totalSharesToSell} shares for {amount:F2} USD from property '{property.Title}'"
            });

            await _context.SaveChangesAsync();
            return Ok(new { shares = totalSharesToSell, amount });
        }


        public class SellToPlatformRequest
        {
            public Guid UserId { get; set; }
            public Guid PropertyId { get; set; }
            public string PinOrPassword { get; set; } = string.Empty;
        }

        [HttpGet("user/{id}/with-property")]
        public async Task<IActionResult> GetInvestmentsWithProperty(Guid id)
        {
            if (User.IsDemo()) return await GetDemoInvestmentsWithProperty();
            var result = await _context.Investments
                .Where(i => i.UserId == id)
                .Include(i => i.Property)
                .Select(i => new
                {
                    i.Id,
                    i.PropertyId,
                    i.Shares,
                    i.InvestedAmount,
                    PropertyTitle = i.Property.Title,
                    BuybackPricePerShare = i.Property.BuybackPricePerShare
                })
                .ToListAsync();

            return Ok(result);
        }
        // todo move
        public class BuySharesRequest
        {
            public Guid BuyerId { get; set; }
            public int SharesToBuy { get; set; }
            public string PinOrPassword { get; set; } = string.Empty;
        }

        [HttpPost("{id}/buy")]
        public async Task<IActionResult> BuyShares(Guid id, [FromBody] BuySharesRequest req)
        {
            if (User.IsDemo()) return await BuyDemoShares(id, req);
            Guid buyerId = req.BuyerId;
            int sharesToBuy = req.SharesToBuy;

            var offer = await _context.ShareOffers.FindAsync(id);
            if (offer == null || !offer.IsActive)
                return NotFound("Offer not found or inactive");

            // для простоты и соответствия UI — покупаем только весь лот
            if (sharesToBuy <= 0 || sharesToBuy != offer.SharesForSale)
                return BadRequest("You must buy the entire lot.");

            var buyer = await _context.Users.FindAsync(buyerId);
            var seller = await _context.Users.FindAsync(offer.SellerId);
            if (buyer == null || seller == null)
                return BadRequest("Buyer or seller not found");

            // PIN / пароль
            if (!string.IsNullOrEmpty(buyer.PinCode))
            {
                if (req.PinOrPassword != buyer.PinCode && req.PinOrPassword != buyer.PasswordHash)
                    return BadRequest("Invalid PIN");
            }
            else
            {
                if (req.PinOrPassword != buyer.PasswordHash)
                    return BadRequest("Invalid password");
            }

            if (!offer.BuyoutPricePerShare.HasValue || offer.BuyoutPricePerShare.Value <= 0)
                return BadRequest("Invalid offer price");

            var property = await _context.Properties.FindAsync(offer.PropertyId);
            if (property == null)
                return BadRequest("Property not found");

            var totalCost = sharesToBuy * offer.BuyoutPricePerShare.Value;
            if (buyer.WalletBalance < totalCost)
                return BadRequest("Insufficient balance");

            // === 1. Покупатель платит полную цену ===
            buyer.WalletBalance -= totalCost;

            // === 2. Считаем себестоимость и прибыль продавца ===
            // При создании оффера мы посчитали LockedInvestedAmount для всех выставленных шеров
            decimal costBasis = offer.LockedInvestedAmount;
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
                    return BadRequest("Super user not configured");

                if (hasReferrer && referral!.ReferrerRewardPercent > 0m && platformFee > 0m)
                {
                    referralReward = Math.Round(platformFee * referral.ReferrerRewardPercent, 2);
                    clubIncome = platformFee - referralReward;
                    if (clubIncome < 0) clubIncome = 0;
                }

                // рефереру
                if (referralReward > 0m)
                {
                    var refUser = await _context.Users.FindAsync(referral!.InviterUserId);
                    if (refUser != null)
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
                            Notes = $"Referral reward from share sale profit of user {seller.Email} on '{property.Title}'"
                        });
                    }
                }

                // клуб (суперпользователь)
                if (clubIncome > 0m)
                {
                    var superUserId2 = _superUserService.GetSuperUserId();
                    var superUser2 = await _context.Users.FindAsync(superUserId2);
                    if (superUser2 == null)
                        return BadRequest("Super user not configured");

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
                        Notes = $"Club fee from share sale profit of user {seller.Email} on '{property.Title}'"
                    });
                }
            }

            // === 4. Продавец получает сумму после вычета комиссии ===
            decimal sellerReceives = totalCost - platformFee;
            seller.WalletBalance += sellerReceives;

            // === 5. Оффер закрываем (лот целиком продан) ===
            offer.SharesForSale = 0;
            offer.IsActive = false;

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
                PricePerShare = offer.BuyoutPricePerShare ?? 0,
                Timestamp = DateTime.UtcNow
            });

            // === 8. Сообщения и UserTransactions (как раньше, только Notes чуть богаче) ===
            _context.Messages.Add(new Message
            {
                RecipientId = seller.Id,
                Title = "Your lot is sold",
                Content = $"Item \"{property.Title}\" was sold. Sum: {totalCost:F2} USD. " +
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
                Notes = $"Share market sell. CostBasis={costBasis:F2}, Profit={profit:F2}, PlatformFee={platformFee:F2}"
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
                Notes = "Share market buy"
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
                Details = $"Offer={id}, Shares={sharesToBuy}, Total={totalCost:F2}, Profit={profit:F2}, Fee={platformFee:F2}"
            });

            await _context.SaveChangesAsync();

            return Ok("Shares purchased successfully.");
        }


        [AllowAnonymous]
        [HttpGet("transactions")]
        public async Task<IActionResult> GetRecentTransactions([FromQuery] Guid? propertyId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            if (User.IsDemo()) return await GetDemoTransactions(propertyId, startDate, endDate);
            var query = _context.ShareTransactions
                .Include(t => t.Property)
                .AsQueryable();

            if (propertyId.HasValue)
                query = query.Where(t => t.PropertyId == propertyId.Value);

            if (startDate.HasValue)
                query = query.Where(t => t.Timestamp >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(t => t.Timestamp <= endDate.Value);

            var result = await query
                .OrderByDescending(t => t.Timestamp)
                .Take(200)
                .Select(t => new
                {
                    t.Timestamp,
                    t.Shares,
                    t.PricePerShare,
                    PropertyId = t.PropertyId,
                    PropertyTitle = t.Property.Title,
                    t.BuyerId,
                    t.SellerId
                })
                .ToListAsync();

            return Ok(result);
        }

        public class CancelOfferRequest
        {
            public string PinOrPassword { get; set; } = string.Empty;
        }


        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelOffer(Guid id, [FromBody] CancelOfferRequest req)
        {
            if (User.IsDemo()) return await CancelDemoOffer(id, req);
            var offer = await _context.ShareOffers.FindAsync(id);
            if (offer == null || !offer.IsActive)
                return NotFound("Offer not found or already inactive");

            var seller = await _context.Users.FindAsync(offer.SellerId);
            if (seller == null)
                return BadRequest("Seller not found");

            if (!string.IsNullOrEmpty(seller.PinCode))
            {
                if (req.PinOrPassword != seller.PinCode && req.PinOrPassword != seller.PasswordHash)
                    return BadRequest("Invalid PIN");
            }
            else
            {
                if (req.PinOrPassword != seller.PasswordHash)
                    return BadRequest("Invalid password");
            }

            // find comission
            var cancelFeeSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "CancelListingFee");
            var fee = cancelFeeSetting != null ? decimal.Parse(cancelFeeSetting.Value) : 0;

            // check balance
            if (seller.WalletBalance < fee)
                return BadRequest($"Insufficient funds for cancellation fee: {fee} USD");

            // check superuser
            var superUserId = _superUserService.GetSuperUserId();
            var superUser = await _context.Users.FindAsync(superUserId);
            if (superUser == null)
                return BadRequest("Superuser not configured");

            // money for superuser
            seller.WalletBalance -= fee;
            superUser.WalletBalance += fee;

            var investments = await _context.Investments
                .Where(i => i.UserId == offer.SellerId && i.PropertyId == offer.PropertyId)
                .OrderBy(i => i.CreatedAt)
                .ToListAsync();

            if (investments.Any())
            {
                investments[0].Shares += offer.SharesForSale;
                investments[0].InvestedAmount += offer.LockedInvestedAmount;
            }
            else
            {
                _context.Investments.Add(new Investment
                {
                    Id = Guid.NewGuid(),
                    UserId = offer.SellerId,
                    PropertyId = offer.PropertyId,
                    Shares = offer.SharesForSale,
                    InvestedAmount = offer.LockedInvestedAmount,
                    CreatedAt = DateTime.UtcNow
                });
            }

            offer.IsActive = false;
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later
                Action = "CancelOffer",
                Details = $"Offer: {id}, Fee: {fee} transferred to superuser"
            });
            await _context.SaveChangesAsync();
            return Ok($"Offer canceled with {fee} USD cancellation fee.");
        }

        //[HttpPost("{id}/extend")]
        //public async Task<IActionResult> ExtendOffer(Guid id, [FromQuery] int days)
        //{
        //    var offer = await _context.ShareOffers.FindAsync(id);
        //    if (offer == null || !offer.IsActive)
        //        return NotFound("Offer not found or inactive");

        //    offer.ExpirationDate = offer.ExpirationDate.AddDays(days);
        //    _context.ActionLogs.Add(new ActionLog
        //    {
        //        UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later
        //        Action = "ExtendOffer",
        //        Details = "days: " + days + "offer " + id
        //    });
        //    await _context.SaveChangesAsync();
        //    return Ok(new { offer.ExpirationDate });
        //}

        public class ExtendOfferRequest
        {
            public DateTime NewDate { get; set; }
            public string PinOrPassword { get; set; } = string.Empty;
        }


        [HttpPost("{id}/extend-to")]
        public async Task<IActionResult> ExtendOfferTo(Guid id, [FromBody] ExtendOfferRequest req)
        {
            if (User.IsDemo()) return await ExtendDemoOffer(id, req);
            var offer = await _context.ShareOffers.FindAsync(id);
            if (offer == null) return NotFound("Offer not found");

            if (!offer.IsActive) return BadRequest("Offer is inactive");

            var seller = await _context.Users.FindAsync(offer.SellerId);
            if (seller == null) return BadRequest("Seller not found");
             
            if (req.NewDate <= DateTime.UtcNow)
                return BadRequest("New expiration must be in the future");

            if (offer.ExpirationDate >= req.NewDate)
                return BadRequest("New expiration must be after current expiration date");

            if (!string.IsNullOrEmpty(seller.PinCode))
            {
                if (req.PinOrPassword != seller.PinCode && req.PinOrPassword != seller.PasswordHash)
                    return BadRequest("Invalid PIN");
            }
            else
            {
                if (req.PinOrPassword != seller.PasswordHash)
                    return BadRequest("Invalid password");
            }

            offer.ExpirationDate = req.NewDate;
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = seller.Id, 
                Action = "ExtendOffer",
                Details = $"date: {req.NewDate.ToShortDateString()}offer {id}"
            });
            await _context.SaveChangesAsync();
            return Ok();
        }

        //[HttpPost("{id}/update-price")]
        //public async Task<IActionResult> UpdateOfferPrice(Guid id, [FromQuery] decimal newPrice)
        //{
        //    var offer = await _context.ShareOffers.FindAsync(id);
        //    if (offer == null || !offer.IsActive)
        //        return NotFound("Offer not found or inactive");

        //    if (newPrice <= 0) return BadRequest("Invalid price");

        //    _context.ActionLogs.Add(new ActionLog
        //    {
        //        UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later
        //        Action = "UpdateOfferPrice",
        //        Details = "Old: " + offer.PricePerShare.ToString() + "New: " + newPrice.ToString()
        //    });

        //    offer.PricePerShare = newPrice;

        //    await _context.SaveChangesAsync();
        //    return Ok(new { offer.PricePerShare });
        //}

        // Добавить ставку (bid) на оффер
        [HttpPost("{id}/bid")]
        public async Task<IActionResult> PlaceBid(Guid id, [FromBody] PlaceBidRequest request)
        {
            if (User.IsDemo()) return await PlaceDemoBid(id, request);
            var offer = await _context.ShareOffers.FindAsync(id);
            if (offer == null || !offer.IsActive || offer.ExpirationDate < DateTime.UtcNow)
                return BadRequest("Offer is not available");
             
            var bidder = await _context.Users.FindAsync(request.BidderId);
            if (bidder == null) return BadRequest("User not found");

            if (!string.IsNullOrEmpty(bidder.PinCode))
            {
                if (request.PinOrPassword != bidder.PinCode && request.PinOrPassword != bidder.PasswordHash)
                    return BadRequest("Invalid PIN");
            }
            else
            {
                if (request.PinOrPassword != bidder.PasswordHash)
                    return BadRequest("Invalid password");
            }

            //if (request.BidPricePerShare <= 0 || offer.PricePerShare == null || request.BidPricePerShare > offer.PricePerShare)
            //    return BadRequest("Invalid bid price");

            if (request.BidPricePerShare <= 0 || request.BidPricePerShare < offer.StartPricePerShare)
                return BadRequest("Invalid bid price");

            if (request.Shares <= 0 || request.Shares > offer.SharesForSale)
                return BadRequest("Invalid number of shares");

            // check wallet
            var total = request.BidPricePerShare * request.Shares;
            if (bidder.WalletBalance < total)
                return BadRequest("Insufficient balance");

            var bid = new ShareOfferBid
            {
                OfferId = id,
                BidderId = request.BidderId,
                BidPricePerShare = request.BidPricePerShare,
                Shares = request.Shares,
                CreatedAt = DateTime.UtcNow
            };

            _context.ShareOfferBids.Add(bid);
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = request.BidderId,
                Action = "PlaceBid",
                Details = $"OfferId: {id}, Price: {request.BidPricePerShare}, Shares: {request.Shares}"
            });

            var property = await _context.Properties.FindAsync(offer.PropertyId);
            // продавцу
            _context.Messages.Add(new Message
            {
                RecipientId = offer.SellerId,
                Title = "New bid on your lot",
                Content = $"User suggested {request.BidPricePerShare:F2} USD for {request.Shares} shares in the lot \"{property.Title}\"."
            });

            // Оповестить других участников торгов
            var otherBidders = await _context.ShareOfferBids
                  .Where(b => b.OfferId == id && b.BidderId != request.BidderId)
                  .Select(b => b.BidderId)
                  .Distinct()
                  .ToListAsync();

            foreach (var userId in otherBidders)
            {
                _context.Messages.Add(new Message
                {
                    RecipientId = userId,
                    Title = "New competing bid",
                    Content = $"A new bid of {request.BidPricePerShare:F2} USD for {request.Shares} shares was placed on lot \"{property?.Title}\". You may want to place a better bid."
                });
            }



            await _context.SaveChangesAsync();
            return Ok(bid);
        }


        // todo move
        public class PlaceBidRequest
        {
            public Guid BidderId { get; set; }
            public decimal BidPricePerShare { get; set; }
            public int Shares { get; set; }
            public string PinOrPassword { get; set; } = string.Empty;
        }

        //Получить список бидов для оффера
        [HttpGet("{id}/bids")]
        public async Task<IActionResult> GetBidsForOffer(Guid id)
        {
            if (User.IsDemo()) return await GetDemoBids(id);
            var bids = await _context.ShareOfferBids
                .Where(b => b.OfferId == id)
                .OrderByDescending(b => b.CreatedAt)
                .Select(b => new
                {
                    b.Id,
                    b.OfferId,
                    b.BidderId,
                    b.BidPricePerShare,
                    b.CreatedAt,
                    b.Shares
                })
                .ToListAsync();

            return Ok(bids);
        }

        [HttpGet("{userId}/club-info")]
        public async Task<IActionResult> GetClubInfo(Guid userId)
        {
            if (User.IsDemo())
            {
                var assets = await CalculateDemoTotalAssets(User.GetUserId());
                var demoStatus = UserFeeHelper.GetStatus(assets);
                var (demoBaseFee, demoWithReferralFee) = UserFeeHelper.GetUserFeePercents(demoStatus);
                var (rewardPercent, rewardYears) = UserFeeHelper.GetReferrerRewardByTotal(assets);
                return Ok(new { totalAssets = Math.Round(assets, 2), status = demoStatus.ToString(), baseFee = demoBaseFee, withReferralFee = demoWithReferralFee, canInvite = false, referrerRewardPercent = rewardPercent, referrerRewardYears = rewardYears });
            }
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return NotFound(new { message = "User not found" });

            // 1) Считаем totalAssets для клубного уровня
            decimal totalAssets = await CalculateTotalAssets(userId);

            // 2) Получаем клубный статус
            var status = UserFeeHelper.GetStatus(totalAssets);

            // 3) Проценты комиссии при продаже на маркете (по прибыли)
            var (baseFee, withReferralFee) = UserFeeHelper.GetUserFeePercents(status);

            // 4) Процент и срок реферальной награды, если пользователь сам кого-то приглашает
            var (referrerRewardPercent, referrerRewardYears) = UserFeeHelper.GetReferrerRewardByTotal(totalAssets);

            bool canInvite = referrerRewardPercent > 0m && totalAssets >= 10_000m;

            return Ok(new
            {
                totalAssets = Math.Round(totalAssets, 2),
                status = status.ToString(),      // "Blue", "Silver", "Gold", "Diamond"
                baseFee,                         // 0.10, 0.09, ...
                withReferralFee,                 // 0.07, 0.06, ...
                canInvite,
                referrerRewardPercent,           // 0.01..0.05
                referrerRewardYears              // 1..5
            });
        }


        private async Task<IActionResult> CreateDemoOffer(CreateShareOfferRequest request)
        {
            var userId = User.GetUserId();
            var seller = await GetActiveDemoUser(userId);
            if (seller == null) return Unauthorized(new { message = "Demo account is inactive, expired, or missing" });
            if (request.PinOrPassword != seller.PinCode) return BadRequest("Invalid PIN");
            if (request.SharesForSale <= 0 || request.StartPricePerShare <= 0 || request.ExpirationDate <= DateTime.UtcNow)
                return BadRequest("Invalid offer parameters");
            if (!await _context.Properties.AsNoTracking().AnyAsync(x => x.Id == request.PropertyId))
                return BadRequest("Property not found");

            await using var tx = await _context.Database.BeginTransactionAsync();
            var investments = await _context.DemoInvestments
                .Where(x => x.DemoUserId == userId && x.PropertyId == request.PropertyId && x.Shares > 0)
                .OrderBy(x => x.CreatedAt).ToListAsync();
            if (investments.Sum(x => x.Shares) < request.SharesForSale)
                return BadRequest("Not enough shares to sell");

            var remaining = request.SharesForSale;
            var locked = 0m;
            foreach (var investment in investments)
            {
                if (remaining == 0) break;
                var count = Math.Min(remaining, investment.Shares);
                var basis = investment.Shares == 0 ? 0 : investment.InvestedAmount / investment.Shares;
                investment.Shares -= count;
                investment.InvestedAmount -= basis * count;
                locked += basis * count;
                remaining -= count;
            }

            var offer = new DemoShareOffer
            {
                DemoSellerId = userId, PropertyId = request.PropertyId,
                DemoInvestmentId = investments.Count == 1 ? investments[0].Id : null,
                SharesForSale = request.SharesForSale, LockedInvestedAmount = locked,
                StartPricePerShare = request.StartPricePerShare, BuyoutPricePerShare = request.BuyoutPricePerShare,
                ExpirationDate = request.ExpirationDate, CreatedAt = DateTime.UtcNow, IsActive = true
            };
            _context.DemoShareOffers.Add(offer);
            AddDemoLog(userId, "CreateOffer", $"Property={request.PropertyId}; Shares={request.SharesForSale}; Locked={locked:F2}");
            seller.LastActiveAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await tx.CommitAsync();
            return Ok(new { offer.Id, SellerId = offer.DemoSellerId, offer.PropertyId, offer.SharesForSale, offer.StartPricePerShare, offer.BuyoutPricePerShare, offer.ExpirationDate, offer.CreatedAt, offer.IsActive, offer.LockedInvestedAmount });
        }

        private async Task<IActionResult> GetDemoGroupedInvestments()
        {
            var userId = User.GetUserId();
            var rows = await _context.DemoInvestments.AsNoTracking().Where(x => x.DemoUserId == userId && x.Shares > 0)
                .GroupBy(x => x.PropertyId).Select(g => new
                {
                    PropertyId = g.Key, Shares = g.Sum(x => x.Shares), TotalInvested = g.Sum(x => x.InvestedAmount),
                    averagePrice = g.Sum(x => x.Shares) == 0 ? 0 : g.Sum(x => x.InvestedAmount) / g.Sum(x => x.Shares),
                    PropertyTitle = g.Select(x => x.Property.Title).FirstOrDefault(),
                    BuybackPricePerShare = g.Select(x => x.Property.BuybackPricePerShare).FirstOrDefault()
                }).ToListAsync();
            return Ok(rows);
        }

        private async Task<IActionResult> GetDemoActiveOffers()
        {
            var now = DateTime.UtcNow;
            var rows = await _context.DemoShareOffers.AsNoTracking()
                .Where(x => x.IsActive && x.ExpirationDate > now)
                .Select(x => new { x.Id, SellerId = x.DemoSellerId, x.PropertyId, x.SharesForSale, x.BuyoutPricePerShare, x.StartPricePerShare, x.ExpirationDate, x.IsActive, x.CreatedAt, PropertyTitle = x.Property.Title })
                .ToListAsync();
            return Ok(rows);
        }

        private async Task<IActionResult> GetDemoUserActiveOffers()
        {
            var userId = User.GetUserId();
            var now = DateTime.UtcNow;
            var rows = await _context.DemoShareOffers.AsNoTracking().Where(x => x.DemoSellerId == userId && x.IsActive && x.ExpirationDate > now)
                .Select(x => new { x.BuyoutPricePerShare, x.StartPricePerShare, x.ExpirationDate }).ToListAsync();
            return Ok(rows);
        }

        private async Task<IActionResult> GetDemoInvestmentsWithProperty()
        {
            var userId = User.GetUserId();
            var rows = await _context.DemoInvestments.AsNoTracking().Where(x => x.DemoUserId == userId)
                .Select(x => new { x.Id, x.PropertyId, x.Shares, x.InvestedAmount, PropertyTitle = x.Property.Title, BuybackPricePerShare = x.Property.BuybackPricePerShare }).ToListAsync();
            return Ok(rows);
        }

        private async Task<IActionResult> BuyDemoShares(Guid offerId, BuySharesRequest request)
        {
            var buyerId = User.GetUserId();
            await using var tx = await _context.Database.BeginTransactionAsync();
            var offer = await _context.DemoShareOffers.Include(x => x.Property).FirstOrDefaultAsync(x => x.Id == offerId);
            if (offer == null || !offer.IsActive || offer.ExpirationDate <= DateTime.UtcNow)
                return NotFound("Offer not found or inactive");
            if (offer.DemoSellerId == buyerId) return BadRequest("You cannot buy your own offer");
            if (request.SharesToBuy <= 0 || request.SharesToBuy != offer.SharesForSale)
                return BadRequest("You must buy the entire lot.");
            if (!offer.BuyoutPricePerShare.HasValue || offer.BuyoutPricePerShare <= 0)
                return BadRequest("Invalid offer price");
            var buyer = await GetActiveDemoUser(buyerId);
            var seller = await GetActiveDemoUser(offer.DemoSellerId);
            if (buyer == null || seller == null) return BadRequest("Buyer or seller not found");
            if (request.PinOrPassword != buyer.PinCode) return BadRequest("Invalid PIN");
            var total = offer.SharesForSale * offer.BuyoutPricePerShare.Value;
            if (buyer.WalletBalance < total) return BadRequest("Insufficient balance");

            var profit = total - offer.LockedInvestedAmount;
            var fee = 0m;
            if (profit > 0)
            {
                var assets = await CalculateDemoTotalAssets(seller.Id);
                var (baseFee, _) = UserFeeHelper.GetUserFeePercents(UserFeeHelper.GetStatus(assets));
                fee = Math.Max(0, Math.Round(profit * baseFee, 2));
            }
            buyer.WalletBalance -= total;
            seller.WalletBalance += total - fee; // demo club fee is intentionally sandbox-only and not credited to production superuser
            offer.SharesForSale = 0;
            offer.IsActive = false;
            var investment = await _context.DemoInvestments.FirstOrDefaultAsync(x => x.DemoUserId == buyerId && x.PropertyId == offer.PropertyId);
            if (investment == null)
                _context.DemoInvestments.Add(new DemoInvestment { DemoUserId = buyerId, PropertyId = offer.PropertyId, Shares = request.SharesToBuy, InvestedAmount = total, CreatedAt = DateTime.UtcNow });
            else { investment.Shares += request.SharesToBuy; investment.InvestedAmount += total; }
            _context.DemoShareTransactions.Add(new DemoShareTransaction { DemoBuyerId = buyerId, DemoSellerId = seller.Id, PropertyId = offer.PropertyId, Shares = request.SharesToBuy, PricePerShare = offer.BuyoutPricePerShare.Value });
            AddDemoUserTransaction(buyerId, TransactionType.ShareMarketBuy, total, request.SharesToBuy, offer.Property, "Demo share market buy");
            AddDemoUserTransaction(seller.Id, TransactionType.ShareMarketSell, total, request.SharesToBuy, offer.Property, $"Demo share market sell; fee={fee:F2}");
            AddDemoLog(buyerId, "BuyShare", $"Offer={offerId}; Total={total:F2}; Fee={fee:F2}");
            buyer.LastActiveAt = seller.LastActiveAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await tx.CommitAsync();
            return Ok("Shares purchased successfully.");
        }

        private async Task<IActionResult> GetDemoTransactions(Guid? propertyId, DateTime? startDate, DateTime? endDate)
        {
            var userId = User.GetUserId();
            var query = _context.DemoShareTransactions.AsNoTracking().Where(x => x.DemoBuyerId == userId || x.DemoSellerId == userId);
            if (propertyId.HasValue) query = query.Where(x => x.PropertyId == propertyId);
            if (startDate.HasValue) query = query.Where(x => x.Timestamp >= startDate);
            if (endDate.HasValue) query = query.Where(x => x.Timestamp <= endDate);
            var rows = await query.OrderByDescending(x => x.Timestamp).Take(200)
                .Select(x => new { x.Timestamp, x.Shares, x.PricePerShare, x.PropertyId, PropertyTitle = x.Property.Title, BuyerId = x.DemoBuyerId, SellerId = x.DemoSellerId }).ToListAsync();
            return Ok(rows);
        }

        private async Task<IActionResult> CancelDemoOffer(Guid offerId, CancelOfferRequest request)
        {
            var userId = User.GetUserId();
            await using var tx = await _context.Database.BeginTransactionAsync();
            var offer = await _context.DemoShareOffers.FirstOrDefaultAsync(x => x.Id == offerId && x.DemoSellerId == userId);
            if (offer == null || !offer.IsActive) return NotFound("Offer not found or already inactive");
            var seller = await GetActiveDemoUser(userId);
            if (seller == null) return Unauthorized();
            if (request.PinOrPassword != seller.PinCode) return BadRequest("Invalid PIN");
            var setting = await _context.SystemSettings.AsNoTracking().FirstOrDefaultAsync(x => x.Key == "CancelListingFee");
            var fee = setting != null && decimal.TryParse(setting.Value, out var parsed) ? parsed : 0m;
            if (seller.WalletBalance < fee) return BadRequest($"Insufficient funds for cancellation fee: {fee} USD");
            seller.WalletBalance -= fee;
            var investment = await _context.DemoInvestments.FirstOrDefaultAsync(x => x.DemoUserId == userId && x.PropertyId == offer.PropertyId);
            if (investment == null)
                _context.DemoInvestments.Add(new DemoInvestment { DemoUserId = userId, PropertyId = offer.PropertyId, Shares = offer.SharesForSale, InvestedAmount = offer.LockedInvestedAmount });
            else { investment.Shares += offer.SharesForSale; investment.InvestedAmount += offer.LockedInvestedAmount; }
            offer.IsActive = false;
            AddDemoLog(userId, "CancelOffer", $"Offer={offerId}; Fee={fee:F2}");
            seller.LastActiveAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await tx.CommitAsync();
            return Ok($"Offer canceled with {fee} USD cancellation fee.");
        }

        private async Task<IActionResult> ExtendDemoOffer(Guid offerId, ExtendOfferRequest request)
        {
            var userId = User.GetUserId();
            var offer = await _context.DemoShareOffers.FirstOrDefaultAsync(x => x.Id == offerId && x.DemoSellerId == userId);
            if (offer == null) return NotFound("Offer not found");
            if (!offer.IsActive) return BadRequest("Offer is inactive");
            var seller = await GetActiveDemoUser(userId);
            if (seller == null) return Unauthorized();
            if (request.PinOrPassword != seller.PinCode) return BadRequest("Invalid PIN");
            if (request.NewDate <= DateTime.UtcNow || request.NewDate <= offer.ExpirationDate)
                return BadRequest("New expiration must be after current expiration date");
            offer.ExpirationDate = request.NewDate;
            seller.LastActiveAt = DateTime.UtcNow;
            AddDemoLog(userId, "ExtendOffer", $"Offer={offerId}; Date={request.NewDate:O}");
            await _context.SaveChangesAsync();
            return Ok();
        }

        private async Task<IActionResult> PlaceDemoBid(Guid offerId, PlaceBidRequest request)
        {
            var bidderId = User.GetUserId();
            await using var tx = await _context.Database.BeginTransactionAsync();
            var offer = await _context.DemoShareOffers.FirstOrDefaultAsync(x => x.Id == offerId);
            if (offer == null || !offer.IsActive || offer.ExpirationDate <= DateTime.UtcNow) return BadRequest("Offer is not available");
            if (offer.DemoSellerId == bidderId) return BadRequest("You cannot bid on your own offer");
            var bidder = await GetActiveDemoUser(bidderId);
            if (bidder == null) return Unauthorized();
            if (request.PinOrPassword != bidder.PinCode) return BadRequest("Invalid PIN");
            if (request.BidPricePerShare <= 0 || request.BidPricePerShare < offer.StartPricePerShare) return BadRequest("Invalid bid price");
            if (request.Shares <= 0 || request.Shares > offer.SharesForSale) return BadRequest("Invalid number of shares");
            if (bidder.WalletBalance < request.BidPricePerShare * request.Shares) return BadRequest("Insufficient balance");
            var bid = new DemoShareOfferBid { DemoOfferId = offerId, DemoBidderId = bidderId, BidPricePerShare = request.BidPricePerShare, Shares = request.Shares, CreatedAt = DateTime.UtcNow };
            _context.DemoShareOfferBids.Add(bid);
            bidder.LastActiveAt = DateTime.UtcNow;
            AddDemoLog(bidderId, "PlaceBid", $"Offer={offerId}; Price={request.BidPricePerShare}; Shares={request.Shares}");
            await _context.SaveChangesAsync();
            await tx.CommitAsync();
            return Ok(new { bid.Id, OfferId = bid.DemoOfferId, BidderId = bid.DemoBidderId, bid.BidPricePerShare, bid.Shares, bid.CreatedAt });
        }

        private async Task<IActionResult> GetDemoBids(Guid offerId)
        {
            var userId = User.GetUserId();
            var offer = await _context.DemoShareOffers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == offerId);
            if (offer == null)
                return NotFound("Offer not found");
            var bids = await _context.DemoShareOfferBids.AsNoTracking().Where(x => x.DemoOfferId == offerId).OrderByDescending(x => x.CreatedAt)
                .Select(x => new { x.Id, OfferId = x.DemoOfferId, BidderId = x.DemoBidderId, x.BidPricePerShare, x.CreatedAt, x.Shares }).ToListAsync();
            return Ok(bids);
        }

        private async Task<DemoUser?> GetActiveDemoUser(Guid id) => await _context.DemoUsers
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsTemplate && x.IsActive && x.ExpiresAt > DateTime.UtcNow);

        private void AddDemoLog(Guid userId, string action, string details) => _context.DemoActionLogs.Add(new DemoActionLog { DemoUserId = userId, Action = action, Details = details });

        private void AddDemoUserTransaction(Guid userId, TransactionType type, decimal amount, int shares, Property property, string notes) =>
            _context.DemoUserTransactions.Add(new DemoUserTransaction { DemoUserId = userId, Type = type, Amount = amount, Shares = shares, PropertyId = property.Id, PropertyTitle = property.Title, Timestamp = DateTime.UtcNow, Notes = notes });

        private async Task<decimal> CalculateDemoTotalAssets(Guid userId)
        {
            var wallet = await _context.DemoUsers.Where(x => x.Id == userId).Select(x => (decimal?)x.WalletBalance).FirstOrDefaultAsync() ?? 0;
            var investments = await _context.DemoInvestments.Where(x => x.DemoUserId == userId && x.Shares > 0)
                .Select(x => new { x.Shares, x.Property.Price, x.Property.TotalShares }).ToListAsync();
            var applications = await _context.DemoInvestmentApplications.Where(x => x.DemoUserId == userId && x.Status == "pending")
                .Select(x => new { x.RequestedShares, x.Property.Price, x.Property.TotalShares }).ToListAsync();
            var offers = await _context.DemoShareOffers.Where(x => x.DemoSellerId == userId && x.IsActive)
                .Select(x => new { x.SharesForSale, x.Property.Price, x.Property.TotalShares }).ToListAsync();
            return wallet
                + investments.Sum(x => x.TotalShares == 0 ? 0 : x.Price / x.TotalShares * x.Shares)
                + applications.Sum(x => x.TotalShares == 0 ? 0 : x.Price / x.TotalShares * x.RequestedShares)
                + offers.Sum(x => x.TotalShares == 0 ? 0 : x.Price / x.TotalShares * x.SharesForSale);
        }

        // Локальный расчёт totalAssets для продавца
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

        // Принять предложение todo удалить метод?
        //[HttpPost("bid/{bidId}/accept")]
        //public async Task<IActionResult> AcceptBid(Guid bidId, [FromQuery] int sharesToSell)
        //{
        //    var bid = await _context.ShareOfferBids
        //        .Include(b => b.Offer)
        //        .FirstOrDefaultAsync(b => b.Id == bidId);

        //    if (bid == null || bid.Offer == null || !bid.Offer.IsActive)
        //        return BadRequest("Invalid bid or offer");

        //    if (sharesToSell > bid.Offer.SharesForSale)
        //        return BadRequest("Not enough shares in the offer");

        //    var buyer = await _context.Users.FindAsync(bid.BidderId);
        //    var seller = await _context.Users.FindAsync(bid.Offer.SellerId);
        //    if (buyer == null || seller == null) return BadRequest();

        //    var totalCost = bid.BidPricePerShare * sharesToSell;
        //    if (buyer.WalletBalance < totalCost) return BadRequest("Insufficient balance");

        //    // Перевод средств
        //    buyer.WalletBalance -= totalCost;
        //    seller.WalletBalance += totalCost;

        //    // Обновление оффера
        //    bid.Offer.SharesForSale -= sharesToSell;
        //    if (bid.Offer.SharesForSale == 0)
        //        bid.Offer.IsActive = false;

        //    // Добавление инвестиций
        //    var investment = await _context.Investments
        //        .FirstOrDefaultAsync(i => i.UserId == buyer.Id && i.PropertyId == bid.Offer.PropertyId);

        //    if (investment == null)
        //    {
        //        investment = new Investment
        //        {
        //            Id = Guid.NewGuid(),
        //            UserId = buyer.Id,
        //            PropertyId = bid.Offer.PropertyId,
        //            Shares = sharesToSell,
        //            InvestedAmount = totalCost,
        //            CreatedAt = DateTime.UtcNow
        //        };
        //        _context.Investments.Add(investment);
        //    }
        //    else
        //    {
        //        investment.Shares += sharesToSell;
        //        investment.InvestedAmount += totalCost;
        //    }

        //    _context.ActionLogs.Add(new ActionLog
        //    {
        //        UserId = seller.Id,
        //        Action = "AcceptBid",
        //        Details = $"BidId: {bidId}, Shares: {sharesToSell}, Price: {bid.BidPricePerShare}"
        //    });

        //    await _context.SaveChangesAsync();
        //    return Ok("Bid accepted and transaction completed.");
        //}


    }
}
