using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/rentals")]
    public class RentalIncomeController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ISuperUserService _superUserService;

        public RentalIncomeController(AppDbContext context, ISuperUserService superUserService)
        {
            _context = context;
            _superUserService = superUserService;
        }

        /// <summary>
        /// Ежемесячная выплата аренды по объекту
        /// </summary>
        [HttpPost("payout/{propertyId}")]
        public async Task<IActionResult> ProcessRentalPayout(Guid propertyId)
        {
            // Подтягиваем объект с нужными полями
            var property = await _context.Properties
                .FirstOrDefaultAsync(p => p.Id == propertyId);

            if (property == null)
                return NotFound(new { message = "Object not found" });

            // Защита от повторной выплаты раньше, чем через 30 дней
            if (DateTime.UtcNow.Subtract(property.LastPayoutDate).Days < 30)
                return BadRequest(new { message = "Payments have already been made this month." });

            // Все инвестиции по объекту с пользователями
            var investments = await _context.Investments
                .Where(i => i.PropertyId == propertyId && i.Shares > 0)
                .Include(i => i.User)
                .ToListAsync();

            if (!investments.Any())
                return BadRequest(new { message = "There are no investors for this property" });

            var totalShares = investments.Sum(i => i.Shares);
            if (totalShares <= 0)
                return BadRequest(new { message = "Total shares for this property is zero" });

            decimal totalIncome = property.MonthlyRentalIncome;
            if (totalIncome <= 0)
                return BadRequest(new { message = "No monthly rental income configured for this property" });

            // Суперпользователь для клубной комиссии
            var superUserId = _superUserService.GetSuperUserId();
            var superUser = await _context.Users.FindAsync(superUserId);
            if (superUser == null)
                return BadRequest(new { message = "Super user not configured" });

            // Все инвесторы по объекту
            var investorIds = investments
                .Select(i => i.UserId)
                .Distinct()
                .ToList();

            // Активные реферальные связи для этих инвесторов
            var referrals = await _context.Referrals
                .Where(r => investorIds.Contains(r.RefereeUserId) &&
                            r.RewardValidUntil > DateTime.UtcNow)
                .ToListAsync();

            // Группируем инвестиции по инвестору
            var groups = investments.GroupBy(i => i.UserId);

            foreach (var grp in groups)
            {
                var investorId = grp.Key;
                var investor = grp.First().User;
                if (investor == null)
                    continue;

                int investorShares = grp.Sum(i => i.Shares);

                // Брутто-доход по аренде до комиссий
                decimal grossIncome = totalIncome * investorShares / totalShares;

                // === 1. Определяем totalAssets для клуба ===
                decimal totalAssets = await CalculateTotalAssets(investorId);
                var status = UserFeeHelper.GetStatus(totalAssets);
                var (baseFeePercent, withReferralFeePercent) = UserFeeHelper.GetUserFeePercents(status);

                // Есть ли активный реферер у этого инвестора
                var referral = referrals.FirstOrDefault(r => r.RefereeUserId == investorId);
                bool hasReferrer = referral != null;

                // Эффективная ставка комиссии (для платформы)
                decimal effectiveFeePercent = hasReferrer ? withReferralFeePercent : baseFeePercent;

                // Сколько комиссии удерживаем с этой арендной выплаты
                decimal fee = Math.Round(grossIncome * effectiveFeePercent, 2);
                if (fee < 0) fee = 0;

                decimal netToInvestor = Math.Round(grossIncome - fee, 2);
                if (netToInvestor < 0) netToInvestor = 0;

                // === 2. Делим комиссию между реферером и клубом (суперпользователь) ===
                decimal referralReward = 0m;
                decimal clubIncome = fee;

                if (hasReferrer && referral!.ReferrerRewardPercent > 0m)
                {
                    referralReward = Math.Round(fee * referral.ReferrerRewardPercent, 2);
                    clubIncome = fee - referralReward;
                    if (clubIncome < 0) clubIncome = 0;
                }

                // === 3. Обновляем балансы ===

                // Инвестору — net
                investor.WalletBalance += netToInvestor;

                // Рефереру — часть комиссии
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
                            Notes = $"Referral reward from rent payout of user {investor.Email} on '{property.Title}'"
                        });
                    }
                }

                // Суперпользователю — остальная часть комиссии
                if (clubIncome > 0m)
                {
                    superUser.WalletBalance += clubIncome;

                    _context.UserTransactions.Add(new UserTransaction
                    {
                        Id = Guid.NewGuid(),
                        UserId = superUser.Id,
                        Type = TransactionType.ClubFeeIncome,
                        Amount = clubIncome,
                        PropertyId = property.Id,
                        PropertyTitle = property.Title,
                        Timestamp = DateTime.UtcNow,
                        Notes = $"Club fee from rent payout of user {investor.Email} on '{property.Title}'"
                    });
                }

                // === 4. Запись о доходе инвестора ===
                _context.RentalIncomes.Add(new RentalIncome
                {
                    PropertyId = property.Id,
                    InvestorId = investorId,
                    Amount = netToInvestor,
                    PayoutDate = DateTime.UtcNow
                });

                _context.UserTransactions.Add(new UserTransaction
                {
                    Id = Guid.NewGuid(),
                    UserId = investorId,
                    Type = TransactionType.RentIncome,
                    Amount = netToInvestor,
                    Shares = investorShares,
                    PropertyId = property.Id,
                    PropertyTitle = property.Title,
                    Timestamp = DateTime.UtcNow,
                    Notes = $"Monthly rent payout (gross {grossIncome:F2}, fee {fee:F2}) for '{property.Title}'"
                });

                // === 5. Лог под парсер MyRentIncomeHistory ===
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = investorId,
                    Action = "MonthlyRentPayout",
                    Details = $"Monthly rent payout for property '{property.Title}' ({property.Id}) - " +
                              $"user {investor.Email} received {netToInvestor:F2} USD (gross {grossIncome:F2}, " +
                              $"fee {fee:F2}, refReward {referralReward:F2})",
                    Timestamp = DateTime.UtcNow
                });

                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later
                    Action = "ProcessRentalPayout",
                    Details = "Process Rental Payout on id:" + propertyId.ToString() + " Investor: " + investorId.ToString()
                });

            }

            // Обновляем дату последней выплаты
            property.LastPayoutDate = DateTime.UtcNow;

       
            await _context.SaveChangesAsync();

            return Ok(new { message = "Payments to investors have been made" });
        }

        /// <summary>
        /// История выплат инвестору (старый метод, оставляем как есть, только сумма теперь net)
        /// </summary>
        [HttpGet("investor/{userId}")]
        public async Task<IActionResult> GetInvestorPayouts(Guid userId)
        {
            var payouts = await _context.RentalIncomes
                .Where(p => p.InvestorId == userId)
                .OrderByDescending(p => p.PayoutDate)
                .ToListAsync();

            return Ok(payouts);
        }

        /// <summary>
        /// Локальный расчёт totalAssets — копия логики из ReferralsController.
        /// Можно потом вынести в общий сервис.
        /// </summary>
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
