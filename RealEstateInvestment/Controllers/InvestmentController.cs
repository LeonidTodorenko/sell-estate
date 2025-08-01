﻿using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Org.BouncyCastle.Asn1.Ocsp;
using Org.BouncyCastle.Utilities;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/investments")]
    public class InvestmentController : ControllerBase
    {
        private readonly AppDbContext _context;
        private static readonly SemaphoreSlim _investmentLock = new(1, 1);

        public InvestmentController(AppDbContext context)
        {
            _context = context;
        }

        //   An investor submits an application to purchase shares - todo старая логика
        [HttpPost("apply_old")]
        public async Task<IActionResult> ApplyForInvestment([FromBody] InvestmentWithPin investmentRequest)
        {
            await _investmentLock.WaitAsync();
            try
            {
                var property = await _context.Properties.FindAsync(investmentRequest.PropertyId);
                if (property == null) return NotFound(new { message = "Object not found" });

                if (DateTime.UtcNow > property.ApplicationDeadline)
                    return BadRequest(new { message = "The application deadline has expired" });

                var user = await _context.Users.FindAsync(investmentRequest.UserId);
                if (user == null)
                    return NotFound(new { message = "User not found" });

                if (!string.IsNullOrEmpty(user.PinCode))
                {
                    if (investmentRequest.PinOrPassword != user.PinCode && investmentRequest.PinOrPassword != user.PasswordHash)
                        return BadRequest(new { message = "Invalid PIN" });
                }
                else
                {
                    if (investmentRequest.PinOrPassword != user.PasswordHash) // TODO: hash
                        return BadRequest(new { message = "Invalid password" });
                }

                if (user.WalletBalance < investmentRequest.InvestedAmount)
                    return BadRequest(new { message = "Insufficient funds" });

                if (property.AvailableShares < investmentRequest.Shares)
                    return BadRequest(new { message = "Not enough free shares" });

                // spending money
                user.WalletBalance -= investmentRequest.InvestedAmount;

                // shares
                property.AvailableShares -= investmentRequest.Shares;

                // If an investor offers to pay the Upfront Payment, they will receive priority
                if (investmentRequest.InvestedAmount >= property.UpfrontPayment)
                {
                    property.PriorityInvestorId = investmentRequest.UserId;
                }

                // Save the application
                _context.Investments.Add(investmentRequest);
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = investmentRequest.UserId,
                    Action = "ApplyForInvestment KycDocument",
                    Details = "Apply For Investment Shares: " + investmentRequest.Shares + "; InvestedAmount: " + investmentRequest.InvestedAmount + "; PropertyId: " + investmentRequest.PropertyId
                });
                await _context.SaveChangesAsync();
                return Ok(new { message = "The application has been submitted" });
            }
            finally
            {
                _investmentLock.Release();
            }

            // todo
            //Сделать статус Investment.Status = pending / confirmed и использовать это при финализации.
            //Добавить логику возврата денег при FinalizeInvestment, если заявка не попала в распределение.
            //В будущем: уведомления, e - mail, журнал транзакций.
        }

        [HttpPost("apply")]
        public async Task<IActionResult> ApplicateForInvestment([FromBody] InvestmentApplicationWithPin req)
        {
            if (req.RequestedShares <= 0)
                return BadRequest(new { message = "RequestedShares must be a positive whole number" });

            var user = await _context.Users.FindAsync(req.UserId);
            if (user == null) return NotFound(new { message = "User not found" });

            var property = await _context.Properties
                                         .Include(p => p.PaymentPlans)
                                         .FirstOrDefaultAsync(p => p.Id == req.PropertyId);
            if (property == null) return NotFound(new { message = "Property not found" });

            if (property.PaymentPlans == null || !property.PaymentPlans.Any())
                return BadRequest(new { message = "No payment plan found" });


            if (!string.IsNullOrEmpty(user.PinCode))
            {
                if (req.PinOrPassword != user.PinCode && req.PinOrPassword != user.PasswordHash)
                    return BadRequest(new { message = "Invalid PIN" });
            }
            else
            {
                if (req.PinOrPassword != user.PasswordHash) // TODO: hash
                    return BadRequest(new { message = "Invalid password" });
            }


            // Проверка, что есть активный этап
            var now = DateTime.UtcNow;
            var step = property.PaymentPlans?
                .FirstOrDefault(p => p.EventDate <= now && now <= p.DueDate);
            if (step == null)
                return BadRequest(new { message = "No active payment step" }); // todo убрать потом

            //if (DateTime.UtcNow > property.ApplicationDeadline)
            //    return BadRequest(new { message = "The application deadline has expired" });

            // calculating and checking wallet
            var pricePerShare = property.Price / property.TotalShares;
            var expectedAmount = req.RequestedShares * pricePerShare;

            if (user.WalletBalance < expectedAmount)
                return BadRequest(new { message = "Insufficient funds" });

            if (property.AvailableShares < req.RequestedShares)
                return BadRequest(new { message = "Not enough free shares" });

            // Если это первый шаг — сохраняем как заявку
            var minEventDate = property.PaymentPlans.Min(p => p.EventDate);

            if (DateTime.UtcNow < minEventDate)
                return BadRequest(new { message = "The application date in not started yet, please try again later." });

            if (step.EventDate == minEventDate)
            {
                user.WalletBalance -= expectedAmount;
                property.AvailableShares -= req.RequestedShares;
                var wasPrior = false;
                // Если сумма >= нужной для текущего этапа — пользователь становится приоритетным
                if (expectedAmount >= step.Total && property.PriorityInvestorId == null)
                {
                    property.PriorityInvestorId = req.UserId;
                    wasPrior = true;
                }

                // Это самый первый шаг
                var app = new InvestmentApplication
                {
                    UserId = req.UserId,
                    PropertyId = req.PropertyId,
                    RequestedAmount = req.RequestedAmount,
                    RequestedShares = req.RequestedShares,
                    StepNumber = req.StepNumber,
                    IsPriority = wasPrior,
                    Status = "pending",
                    CreatedAt = now
                };

                _context.InvestmentApplications.Add(app);

                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = req.UserId,
                    Action = "ApplicateForInvestment",
                    Details = "Investment Shares: " + req.RequestedShares + "; InvestedAmount: " + expectedAmount + "; PropertyId: " + req.PropertyId
                });

                _context.UserTransactions.Add(new UserTransaction
                {
                    Id = Guid.NewGuid(),
                    UserId = req.UserId,
                    Type = TransactionType.Investment,
                    Amount = req.RequestedAmount,
                    Shares = req.RequestedShares,
                    PropertyId = property.Id,
                    PropertyTitle = property.Title,
                    Timestamp = DateTime.UtcNow,
                    Notes = "Investment"
                });

                // step.Paid += expectedAmount;
            }
            else
            {
                // Автоматическое превращение заявки в инвестицию
                user.WalletBalance -= expectedAmount;
                property.AvailableShares -= req.RequestedShares;

                step.Paid += expectedAmount; // todo учесть шаг для междусобытийных периодов

                _context.Investments.Add(new Investment
                {
                    UserId = req.UserId,
                    PropertyId = req.PropertyId,
                    Shares = req.RequestedShares,
                    InvestedAmount = expectedAmount,
                    CreatedAt = now
                });

                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = req.UserId,
                    Action = "ApplicateForInvestment",
                    Details = "Apply For Investment Shares: " + req.RequestedShares + "; InvestedAmount: " + expectedAmount + "; PropertyId: " + req.PropertyId
                });

                _context.UserTransactions.Add(new UserTransaction
                {
                    Id = Guid.NewGuid(),
                    UserId = req.UserId,
                    Type = TransactionType.Investment,
                    Amount = expectedAmount,
                    Shares = req.RequestedShares,
                    PropertyId = property.Id,
                    PropertyTitle = property.Title,
                    Timestamp = DateTime.UtcNow,
                    Notes = "Apply For Investment Shares"
                });

            }

            //var app = new InvestmentApplication
            //{
            //    UserId = req.UserId,
            //    PropertyId = req.PropertyId,
            //    RequestedAmount = req.RequestedAmount,
            //    RequestedShares = req.RequestedShares,
            //    StepNumber = req.StepNumber,
            //    IsPriority = false
            //};

            //_context.InvestmentApplications.Add(app);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Application submitted" });
        }

        // todo move
        public class InvestmentWithPin : Investment
        {
            public string PinOrPassword { get; set; }
        }

        public class InvestmentApplicationWithPin : InvestmentApplication
        {
            public string PinOrPassword { get; set; }
        }

        // Completing the share purchase process (used after the bid period expires)
        [HttpPost("finalize/{propertyId}")]
        public async Task<IActionResult> FinalizeInvestment(Guid propertyId)
        {
            var property = await _context.Properties.FindAsync(propertyId);
            if (property == null) return NotFound(new { message = "Object not found" });

            if (DateTime.UtcNow < property.ApplicationDeadline)
                return BadRequest(new { message = "The deadline for applications has not yet expired" });

            var priorityInvestor = await _context.Investments
                .Where(i => i.PropertyId == propertyId && i.UserId == property.PriorityInvestorId)
                .FirstOrDefaultAsync();

            if (priorityInvestor != null)
            {
                // The priority investor buys out all available shares
                property.AvailableShares = 0;
            }
            else
            {
                // todo check - Property cannot be finalized until at least 40% of the payment plan is paid
                var paymentPlans = await _context.PaymentPlans
                    .Where(p => p.PropertyId == propertyId)
                    .ToListAsync();
                if (paymentPlans.Count > 0)
                {
                    var totalDue = paymentPlans.Sum(p => p.Total);
                    var totalPaid = paymentPlans.Sum(p => p.Paid);
                    var paidPercentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

                    if (paidPercentage < 40)
                    {
                        return BadRequest(new { message = "Property cannot be finalized until at least 40% of the payment plan is paid" });
                    }
                }

                //
                // добавить внутреннюю биржу 
                // переделать на дату подачи - если только один не перекрыл всю сумму (сумма для старта, сумма пеймент плана, у админа есть возможность повысить стоимость объекта но shares остаются прежними  у тех кто купил первыми, добавить дату сдачи дома ожидаемую, добавить возможность выставлять объект с определенным числом SHARES , допустим распредление раз в месяц происходит)
                // If no one has made an Upfront Payment, shares are distributed among applications
                var investments = await _context.Investments
                    .Where(i => i.PropertyId == propertyId)
                    .OrderByDescending(i => i.InvestedAmount) // The higher the amount, the higher the chance of getting shares
                    .ToListAsync();

                foreach (var investment in investments)
                {
                    if (property.AvailableShares == 0) break;

                    int allocatedShares = Math.Min(investment.Shares, property.AvailableShares);
                    investment.Shares = allocatedShares;
                    property.AvailableShares -= allocatedShares;
                }
            }

            property.Status = "sold";
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                Action = "FinalizeInvestment",
                Details = "Finalize Investment propertyId: " + propertyId.ToString()
            });
            await _context.SaveChangesAsync();
            return Ok(new { message = "Investments distributed" });
        }

        [HttpPost("validate-payments/{propertyId}")]
        public async Task<IActionResult> ValidateInitialPayment(Guid propertyId)
        {
            var property = await _context.Properties.FindAsync(propertyId);
            if (property == null) return NotFound(new { message = "Property not found" });

            var firstPayment = await _context.PaymentPlans
                .Where(p => p.PropertyId == propertyId)
                .OrderBy(p => p.DueDate)
                .FirstOrDefaultAsync();

            if (firstPayment == null)
                return BadRequest(new { message = "No payment plan found" });

            if (DateTime.UtcNow < firstPayment.DueDate)
                return BadRequest(new { message = "It's too early to validate payments" });

            var totalInvested = await _context.Investments
                .Where(i => i.PropertyId == propertyId)
                .SumAsync(i => i.InvestedAmount);

            if (totalInvested < firstPayment.Total)
            {
                // Отзываем все заявки
                var investments = await _context.Investments
                    .Where(i => i.PropertyId == propertyId)
                    .ToListAsync();

                foreach (var inv in investments)
                {
                    var user = await _context.Users.FindAsync(inv.UserId);
                    if (user != null)
                    {
                        user.WalletBalance += inv.InvestedAmount;
                        property.AvailableShares += inv.Shares;

                        _context.ActionLogs.Add(new ActionLog
                        {
                            UserId = inv.UserId,
                            Action = "InvestmentRevoked",
                            Details = $"Investment {inv.Id} was revoked due to unpaid first milestone"
                        });
                    }
                }

                _context.Investments.RemoveRange(investments);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Investments revoked: not enough funds for first milestone" });
            }

            return Ok(new { message = "First milestone is covered, no action needed" });
        }


        // Get user investments
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserInvestments(Guid userId)
        {
            var investments = await _context.Investments
                .Where(i => i.UserId == userId)
                .ToListAsync();

            return Ok(investments);
        }

        [HttpGet("all")]
        public async Task<IActionResult> GetAllInvestments()
        {
            var result = await (
                from i in _context.Investments
                join u in _context.Users on i.UserId equals u.Id
                join p in _context.Properties on i.PropertyId equals p.Id
                orderby i.CreatedAt descending
                select new
                {
                    InvestmentId = i.Id,
                    UserId = u.Id,
                    UserName = u.FullName,
                    PropertyName = p.Title,
                    i.Shares,
                    i.InvestedAmount,
                    i.CreatedAt
                }
            ).ToListAsync();

            return Ok(result);
        }

        [HttpGet("kyc/pending")]
        public async Task<IActionResult> GetUsersWithPendingKyc()
        {
            var users = await _context.Users
                .Where(u => u.KycStatus == "pending")
                .OrderBy(u => u.CreatedAt)
                .ToListAsync();

            return Ok(users);
        }

        [HttpPost("{id}/kyc/verify")]
        public async Task<IActionResult> VerifyKyc(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.KycStatus = "verified";
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                Action = "VerifyKyc",
                Details = "Verify Kyc id: " + id.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "User KYC verified" });
        }

        [HttpPost("{id}/kyc/reject")]
        public async Task<IActionResult> RejectKyc(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.KycStatus = "rejected";
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                Action = "RejectKyc",
                Details = "Reject Kyc id: " + id.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "User KYC rejected" });
        }
         
        [HttpGet("with-aggregated/{userId}")]
        public async Task<IActionResult> GetUserAggregatedInvestments(Guid userId)
        {

            var onMarket = await (
                   from o in _context.ShareOffers
                   where o.SellerId == userId && o.IsActive
                   group o by o.PropertyId into g
                   select new
                   {
                       PropertyId = g.Key,
                       MarketShares = g.Sum(x => x.SharesForSale)
                   }
               ).ToListAsync();


            var confirmed = await (
                    from i in _context.Investments
                    join p in _context.Properties on i.PropertyId equals p.Id
                    where i.UserId == userId && i.Shares > 0
                    group new { i, p } by new { i.PropertyId, p.Title, p.Price, p.TotalShares, p.MonthlyRentalIncome } into g
                    select new
                    {
                        PropertyId = g.Key.PropertyId,
                        PropertyTitle = g.Key.Title,
                        PropertyPrice= g.Key.Price,
                        PropertyTotalShares = g.Key.TotalShares,
                        MonthlyRentalIncome = g.Key.MonthlyRentalIncome,
                        ConfirmedShares = g.Sum(x => x.i.Shares),
                        ConfirmedAmount = g.Sum(x => x.i.InvestedAmount),
                        OwnershipPercent = Math.Round(g.Sum(x => x.i.InvestedAmount) / g.Key.Price * 100, 2),
                    }
                ).ToListAsync();

            var pending = await (
                    from a in _context.InvestmentApplications
                    join p in _context.Properties on a.PropertyId equals p.Id
                    where a.UserId == userId && a.Status == "pending" && a.RequestedShares > 0
                    group new { a, p } by new { a.PropertyId } into g
                    select new
                    {
                        PropertyId = g.Key.PropertyId,
                        PendingShares = g.Sum(x => x.a.RequestedShares),
                        PendingCount = g.Count()
                    }
                ).ToListAsync();

            var merged = confirmed.Select(c =>
            {
                var p = pending.FirstOrDefault(x => x.PropertyId == c.PropertyId);
                var m = onMarket.FirstOrDefault(x => x.PropertyId == c.PropertyId);

                int totalShares = c.PropertyTotalShares > 0 ? c.PropertyTotalShares : 1;
                decimal totalRentalIncome = c.MonthlyRentalIncome;
                decimal userRentalIncome = (totalRentalIncome / totalShares) * c.ConfirmedShares;

                return new
                {
                    c.PropertyId,
                    c.PropertyTitle,
                    TotalShares = c.ConfirmedShares + (p?.PendingShares ?? 0),
                    ConfirmedShares = c.ConfirmedShares,
                    ConfirmedApplications = (p?.PendingCount ?? 0),
                    MarketShares = m?.MarketShares ?? 0,
                    TotalInvested = c.ConfirmedAmount,
                    c.OwnershipPercent,
                    MonthlyRentalIncome = Math.Round(userRentalIncome, 2),
                    TotalShareValue = (c.ConfirmedShares + (p?.PendingShares ?? 0))* (c.PropertyPrice / c.PropertyTotalShares)
                };
            });

            return Ok(merged);
        }

        //   without summing up investments
        [HttpGet("with-details/{userId}")]
        public async Task<IActionResult> GetUserInvestmentsWithDetails(Guid userId)
        {
            var result = await (
                from i in _context.Investments
                join p in _context.Properties on i.PropertyId equals p.Id
                where i.UserId == userId
                select new
                {
                    InvestmentId = i.Id,
                    PropertyId = p.Id,
                    PropertyTitle = p.Title,
                    i.Shares,
                    i.InvestedAmount,
                    i.CreatedAt,
                    Percent = Math.Round(i.InvestedAmount / p.Price * 100, 2)
                }
            ).ToListAsync();

            return Ok(result);
        }

        [HttpDelete("{investmentId}")]
        public async Task<IActionResult> DeleteInvestment(Guid investmentId)
        {
            var investment = await _context.Investments.FindAsync(investmentId);
            if (investment == null)
                return NotFound(new { message = "Investment not found" });

            var user = await _context.Users.FindAsync(investment.UserId);
            var property = await _context.Properties.FindAsync(investment.PropertyId);

            if (user == null || property == null)
                return BadRequest(new { message = "Related user or property not found" });

            if (property.Status == "sold")
                return BadRequest(new { message = "Cannot cancel investment. Property is already sold." });

            if (DateTime.UtcNow > property.ApplicationDeadline)
                return BadRequest(new { message = "Cannot cancel investment after the application deadline." });


            // Refund to the user
            user.WalletBalance += investment.InvestedAmount;

            // Returning shares back to the property
            property.AvailableShares += investment.Shares;

            _context.Investments.Remove(investment);
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                Action = "DeleteInvestment",
                Details = "Delete Investment investmentId: " + investmentId.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Investment cancelled and funds returned" });

            // todo Защиту от удаления после дедлайна или финализации - убрать это и на ui
        }
    }
}
