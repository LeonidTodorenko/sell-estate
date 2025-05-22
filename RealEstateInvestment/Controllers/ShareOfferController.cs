using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
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
