using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
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
            var investment = await _context.Investments
                .Include(i => i.Property)
                .Include(i => i.User)
                .FirstOrDefaultAsync(i => i.Id == request.InvestmentId && i.UserId == request.UserId);

            if (investment == null || investment.Shares < request.SharesToSell)
                return BadRequest("Invalid investment or not enough shares");

            var pricePerShare = investment.Property.BuybackPricePerShare;
            if (pricePerShare == null) return BadRequest("No buyback price available");

            var amount = pricePerShare.Value * request.SharesToSell;

            var superUserId = _superUserService.GetSuperUserId();
            var superUser = await _context.Users.FindAsync(superUserId);
            if (superUser == null) return BadRequest("Super user not found");

            if (superUser.WalletBalance < amount)
                return BadRequest("Platform has insufficient funds");
             
            investment.InvestedAmount -= (investment.InvestedAmount / investment.Shares) * request.SharesToSell;
            investment.User.WalletBalance += amount;
            investment.Shares -= request.SharesToSell;

            superUser.WalletBalance -= amount;

            var existing = await _context.Investments.FirstOrDefaultAsync(i => i.UserId == superUserId && i.PropertyId == investment.PropertyId);

            if (existing == null)
            {
                existing = new Investment
                {
                    Id = Guid.NewGuid(),
                    UserId = superUserId,
                    PropertyId = investment.PropertyId,
                    Shares = request.SharesToSell,
                    InvestedAmount = amount,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Investments.Add(existing);
            }
            else
            {
                existing.Shares += request.SharesToSell;
                existing.InvestedAmount += amount;
            }

            if (investment.Shares == 0)
                _context.Investments.Remove(investment);

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = request.UserId, // todo add admin guid later
                Action = "SellToPlatform",
                Details = "request.SharesToSell: " + request.SharesToSell
            });

            await _context.SaveChangesAsync();
            return Ok(new { amount });
        }

        public class SellToPlatformRequest
        {
            public Guid InvestmentId { get; set; }
            public Guid UserId { get; set; }
            public int SharesToSell { get; set; }
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

        [HttpPost("{id}/buy")]
        public async Task<IActionResult> BuyShares(Guid id, [FromQuery] Guid buyerId, [FromQuery] int sharesToBuy)
        {
            var offer = await _context.ShareOffers.FindAsync(id);
            if (offer == null || !offer.IsActive) return NotFound();

            if (sharesToBuy > offer.SharesForSale)
                return BadRequest("Not enough shares in offer");

            var buyer = await _context.Users.FindAsync(buyerId);
            var seller = await _context.Users.FindAsync(offer.SellerId);
            if (buyer == null || seller == null) return BadRequest();

            if (!offer.BuyoutPricePerShare.HasValue || offer.BuyoutPricePerShare.Value <= 0) // todo test
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

            await _context.SaveChangesAsync();

            return Ok("Shares purchased successfully.");
        }

        //[AllowAnonymous]
        [HttpGet("transactions")]
        public async Task<IActionResult> GetRecentTransactions()
        {
            var transactions = await _context.ShareTransactions
                .OrderByDescending(t => t.Timestamp)
                .Take(50)
                .Include(t => t.Property)
                .Select(t => new
                {
                    t.Timestamp,
                    t.Shares,
                    t.PricePerShare,
                    PropertyTitle = t.Property.Title
                })
                .ToListAsync();

            return Ok(transactions);
        }

        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelOffer(Guid id)
        {
            var offer = await _context.ShareOffers.FindAsync(id);
            if (offer == null || !offer.IsActive)
                return NotFound("Offer not found or already inactive");

            var seller = await _context.Users.FindAsync(offer.SellerId);
            if (seller == null)
                return BadRequest("Seller not found");

            // find comission
            var cancelFeeSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "CancelListingFee");
            var fee = cancelFeeSetting != null ? decimal.Parse(cancelFeeSetting.Value) : 0;

            // check balance
            if (seller.WalletBalance < fee)
                return BadRequest($"Insufficient funds for cancellation fee: {fee} USD");

            // check superuser
            var superUser = await _context.Users.FirstOrDefaultAsync(u => u.Role == "superuser");
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

        [HttpPost("share-offers/{id}/extend-to")]
        public async Task<IActionResult> ExtendOfferTo(Guid id, [FromQuery] DateTime newDate)
        {
            var offer = await _context.ShareOffers.FindAsync(id);
            if (offer == null) return NotFound("Offer not found");

            if (!offer.IsActive) return BadRequest("Offer is inactive");

            if (newDate <= DateTime.UtcNow)
                return BadRequest("New expiration must be in the future");

            if (offer.ExpirationDate >= newDate)
                return BadRequest("New expiration must be after current expiration date");

            offer.ExpirationDate = newDate;
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                Action = "ExtendOffer",
                Details = $"date: {newDate.ToShortDateString}offer {id}"
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

            //if (request.BidPricePerShare <= 0 || offer.PricePerShare == null || request.BidPricePerShare > offer.PricePerShare)
            //    return BadRequest("Invalid bid price");

            if (request.BidPricePerShare <= 0 || request.BidPricePerShare < offer.StartPricePerShare)
                return BadRequest("Invalid bid price");

            if (request.Shares <= 0 || request.Shares > offer.SharesForSale)
                return BadRequest("Invalid number of shares");

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

            await _context.SaveChangesAsync();
            return Ok(bid);
        }


        // todo move
        public class PlaceBidRequest
        {
            public Guid BidderId { get; set; }
            public decimal BidPricePerShare { get; set; }
            public int Shares { get; set; }
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
        [HttpPost("bid/{bidId}/accept")]
        public async Task<IActionResult> AcceptBid(Guid bidId, [FromQuery] int sharesToSell)
        {
            var bid = await _context.ShareOfferBids
                .Include(b => b.Offer)
                .FirstOrDefaultAsync(b => b.Id == bidId);

            if (bid == null || bid.Offer == null || !bid.Offer.IsActive)
                return BadRequest("Invalid bid or offer");

            if (sharesToSell > bid.Offer.SharesForSale)
                return BadRequest("Not enough shares in the offer");

            var buyer = await _context.Users.FindAsync(bid.BidderId);
            var seller = await _context.Users.FindAsync(bid.Offer.SellerId);
            if (buyer == null || seller == null) return BadRequest();

            var totalCost = bid.BidPricePerShare * sharesToSell;
            if (buyer.WalletBalance < totalCost) return BadRequest("Insufficient balance");

            // Перевод средств
            buyer.WalletBalance -= totalCost;
            seller.WalletBalance += totalCost;

            // Обновление оффера
            bid.Offer.SharesForSale -= sharesToSell;
            if (bid.Offer.SharesForSale == 0)
                bid.Offer.IsActive = false;

            // Добавление инвестиций
            var investment = await _context.Investments
                .FirstOrDefaultAsync(i => i.UserId == buyer.Id && i.PropertyId == bid.Offer.PropertyId);

            if (investment == null)
            {
                investment = new Investment
                {
                    Id = Guid.NewGuid(),
                    UserId = buyer.Id,
                    PropertyId = bid.Offer.PropertyId,
                    Shares = sharesToSell,
                    InvestedAmount = totalCost,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Investments.Add(investment);
            }
            else
            {
                investment.Shares += sharesToSell;
                investment.InvestedAmount += totalCost;
            }

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = seller.Id,
                Action = "AcceptBid",
                Details = $"BidId: {bidId}, Shares: {sharesToSell}, Price: {bid.BidPricePerShare}"
            });

            await _context.SaveChangesAsync();
            return Ok("Bid accepted and transaction completed.");
        }


    }
}
