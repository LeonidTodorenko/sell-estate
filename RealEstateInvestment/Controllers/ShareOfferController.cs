using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Org.BouncyCastle.Asn1.Ocsp;
using Org.BouncyCastle.Ocsp;
using Org.BouncyCastle.Utilities;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
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
        }

        [HttpGet("user/{id}/grouped")]
        public async Task<IActionResult> GetGroupedInvestments(Guid id)
        {
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
            var investments = await _context.Investments
                .Include(i => i.Property)
                .Include(i => i.User)
                .Where(i => i.UserId == request.UserId && i.PropertyId == request.PropertyId)
                .ToListAsync();

            if (!investments.Any())
                return BadRequest("No investments found for this property");

            var property = investments.First().Property;
            var user = investments.First().User;

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
        }

        [HttpGet("user/{id}/with-property")]
        public async Task<IActionResult> GetInvestmentsWithProperty(Guid id)
        {
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
            Guid buyerId = req.BuyerId;
            int sharesToBuy = req.SharesToBuy;
            var offer = await _context.ShareOffers.FindAsync(id);
            if (offer == null || !offer.IsActive) return NotFound();

            if (sharesToBuy > offer.SharesForSale)
                return BadRequest("Not enough shares in offer");

            var buyer = await _context.Users.FindAsync(buyerId);
            var seller = await _context.Users.FindAsync(offer.SellerId);
            if (buyer == null || seller == null) return BadRequest();

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

            if (!offer.BuyoutPricePerShare.HasValue && offer.BuyoutPricePerShare.Value <= 0) // todo test
                return BadRequest("Invalid offer price");

            var totalCost = sharesToBuy * offer.BuyoutPricePerShare.Value;
            if (buyer.WalletBalance < totalCost) return BadRequest("Insufficient balance");

            // Трансфер средств
            buyer.WalletBalance -= totalCost;
            seller.WalletBalance += totalCost;

            // Уменьшаем кол-во доступных шеров в оффере
            //offer.SharesForSale -= sharesToBuy;
            //if (offer.SharesForSale == 0) offer.IsActive = false;

            offer.IsActive = false;

            //  добавляем покупателю
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

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = buyerId,
                Action = "buy share",
                Details = "sharesToBuy: " + sharesToBuy + "offer " + id
            });

            _context.ShareTransactions.Add(new ShareTransaction
            {
                BuyerId = buyer.Id,
                SellerId = seller.Id,
                PropertyId = offer.PropertyId,
                Shares = sharesToBuy,
                PricePerShare = offer.BuyoutPricePerShare ?? 0,
                Timestamp = DateTime.UtcNow
            });

            var property = await _context.Properties.FindAsync(offer.PropertyId);

            if (property == null)
                return BadRequest("Propery not found");

            _context.Messages.Add(new Message
            {
                RecipientId = seller.Id,
                Title = "Your lot  is sold",
                Content = $"Item \"{property.Title}\" was sold. Sum: {totalCost:F2} USD."
            });
            _context.UserTransactions.Add(new UserTransaction
            {
                Id = Guid.NewGuid(),
                UserId = seller.Id,
                Type = TransactionType.ShareMarketSell,
                Amount = totalCost,
                Shares = sharesToBuy,
                PropertyId = property.Id,
                PropertyTitle = property.Title,
                Timestamp = DateTime.UtcNow,
                Notes = "Lot  is sold"
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
                Notes = "Lot buy"
            });

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
                    Title = " Lot is sold",
                    Content = $"Lot \"{property.Title}\", the item you bid on was sold to another user."
                });
            }

            await _context.SaveChangesAsync();

            return Ok("Shares purchased successfully.");
        }

        [AllowAnonymous]
        [HttpGet("transactions")]
        public async Task<IActionResult> GetRecentTransactions([FromQuery] Guid? propertyId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
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
                    PropertyTitle = t.Property.Title
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
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
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
        //        UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
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
        //        UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
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
            var bids = await _context.ShareOfferBids
                .Where(b => b.OfferId == id)
                .OrderByDescending(b => b.CreatedAt)
                .Select(b => new
                {
                    b.Id,
                    b.BidPricePerShare,
                    b.CreatedAt,
                    b.Shares
                })
                .ToListAsync();

            return Ok(bids);
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
