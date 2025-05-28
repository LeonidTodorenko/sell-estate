using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Migrations;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/share-offers")]
    public class ShareOfferController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ShareOfferController(AppDbContext context)
        {
            _context = context;
        }

        //  Добавить новое предложение
        [HttpPost]
        public async Task<IActionResult> CreateOffer([FromBody] ShareOffer offer)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var investment = await _context.Investments.FindAsync(offer.InvestmentId);
            if (investment == null || investment.UserId != offer.SellerId)
                return BadRequest("Invalid investment or unauthorized");

            // Проверка на количество доступных долей
            if (offer.SharesForSale > investment.Shares)
                return BadRequest("Cannot sell more shares than owned");

            offer.Id = Guid.NewGuid();
            offer.CreatedAt = DateTime.UtcNow;
            offer.IsActive = true;

            _context.ShareOffers.Add(offer);
            await _context.SaveChangesAsync();

            return Ok(offer);
        }


        //  Все активные предложения
        [HttpGet("active")]
        public async Task<IActionResult> GetActiveOffers()
        {
            var offers = await _context.ShareOffers
                .Where(o => o.IsActive && o.ExpirationDate > DateTime.UtcNow)
                .Include(o => o.Property)  
                .Select(o => new
                {
                    o.Id,
                    o.InvestmentId,
                    o.SellerId,
                    o.PropertyId,
                    o.SharesForSale,
                    o.PricePerShare,
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
                .Select(o => new {
                    o.InvestmentId,
                    o.PricePerShare,
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
                .FirstOrDefaultAsync(i => i.Id == request.InvestmentId && i.UserId == request.UserId);

            if (investment == null || investment.Shares < request.SharesToSell)
                return BadRequest("Invalid investment or not enough shares");

            var pricePerShare = investment.Property.BuybackPricePerShare;
            if (pricePerShare == null) return BadRequest("No buyback price available");

            var amount = pricePerShare.Value * request.SharesToSell;

            investment.Shares -= request.SharesToSell;
            investment.User.WalletBalance += amount;

            if (investment.Shares == 0)
                _context.Investments.Remove(investment);

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
                .Select(i => new {
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

            var totalCost = sharesToBuy * offer.PricePerShare;
            if (buyer.WalletBalance < totalCost) return BadRequest("Insufficient balance");

            // Трансфер средств
            buyer.WalletBalance -= totalCost;
            seller.WalletBalance += totalCost;

            // Уменьшаем кол-во доступных шеров в оффере
            offer.SharesForSale -= sharesToBuy;
            if (offer.SharesForSale == 0) offer.IsActive = false;

            // Обновление долей: уменьшаем у продавца, добавляем покупателю
            var sellerInvestment = await _context.Investments.FindAsync(offer.InvestmentId);
            if (sellerInvestment != null)
            {
                sellerInvestment.Shares -= sharesToBuy;
            }

            var buyerInvestment = await _context.Investments
                .FirstOrDefaultAsync(i => i.UserId == buyerId && i.PropertyId == sellerInvestment.PropertyId);

            if (buyerInvestment == null)
            {
                buyerInvestment = new Investment
                {
                    Id = Guid.NewGuid(),
                    UserId = buyerId,
                    PropertyId = sellerInvestment.PropertyId,
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

            await _context.SaveChangesAsync();

            return Ok("Shares purchased successfully.");
        }

        public class BuyRequest
        {
            public Guid BuyerId { get; set; }
            public int Shares { get; set; }
        }
    }

}
