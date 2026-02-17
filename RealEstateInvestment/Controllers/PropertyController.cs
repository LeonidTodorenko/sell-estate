using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;
using Org.BouncyCastle.Asn1.Ocsp;
using Org.BouncyCastle.Ocsp;
using RealEstateInvestment.Data;
using RealEstateInvestment.Enums;
using RealEstateInvestment.Helpers;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/properties")]
    public class PropertyController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IFirebaseNotificationService _firebaseNotificationService;
        private readonly IConfiguration _config;
        private readonly ILogger<PropertyController> _logger;

        public class UploadImageRequest
        {
            public string Base64Image { get; set; }
        }

        public PropertyController(AppDbContext context, IFirebaseNotificationService firebaseNotificationService, IConfiguration config, ILogger<PropertyController> logger)
        {
            _context = context;
            _firebaseNotificationService = firebaseNotificationService;
            _config = config;
            _logger = logger;
        }

        // Get a list of real estate properties
        [HttpGet]
        public async Task<IActionResult> GetProperties()
        {
            var properties = await _context.Properties.ToListAsync();
            return Ok(properties);
        }

        //  Add Property
        [HttpPost]
        public async Task<IActionResult> CreateProperty([FromBody] Property property)
        {
            //if (property.TotalShares <= 0)
            //    return BadRequest(new { message = "TotalShares must be greater than 0" });


            //if (property.AvailableShares < 0)
            //    return BadRequest(new { message = "AvailableShares cannot be negative" });

            //if (property.AvailableShares > property.TotalShares)
            //    return BadRequest(new { message = "AvailableShares cannot exceed TotalShares" });

            if (property.Price <= 0)
                return BadRequest(new { message = "Price must be positive" });

            // totalShares считается автоматически: округляется вверх
            property.TotalShares = (int)Math.Ceiling(property.Price / 1000m);
            property.AvailableShares = property.TotalShares;

            property.RealPrice = property.Price; // сохраняем оригинальную цену
            property.Price = property.TotalShares * 1000; // округляем до ближайшего 1000

            var sharePrice = property.Price / property.TotalShares;

            if (sharePrice < 1000)
            {
                return BadRequest(new { message = $"Share price (${sharePrice:F2}) is too low. Must be at least $1000." });
            }



            property.AvailableShares = property.TotalShares;
            // property.ApplicationDeadline = DateTime.SpecifyKind(property.ApplicationDeadline, DateTimeKind.Utc);

            try
            {
                _context.Properties.Add(property);
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later
                    Action = "CreateProperty",
                    Details = $"Created: {property.Title} with shares: {property.TotalShares}"
                });
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                return BadRequest(ex);
            }

            return Ok(new { message = "Property added" });
        }

        // Change the status of the object (sold, rented)
        [HttpPost("{id}/change-status")]
        public async Task<IActionResult> ChangePropertyStatus(Guid id, [FromBody] string status)
        {
            if (status != "pending" && status != "available" && status != "sold" && status != "rented") // todo add enum
                return BadRequest(new { message = "Wrong state" });

            var property = await _context.Properties.FindAsync(id);
            if (property == null) return NotFound(new { message = "Property not found" });

            property.Status = status;
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later
                Action = "ChangePropertyStatus",
                Details = "Property changed: " + status + " Id:" + id.ToString()
            });
            await _context.SaveChangesAsync();
            return Ok(new { message = "Status updated" });
        }

        // todo check
        [HttpGet("my-properties/{userId}")]
        public async Task<IActionResult> GetUserPropertyInvestments(Guid userId)
        {
            var result = await (
                from inv in _context.Investments
                join prop in _context.Properties on inv.PropertyId equals prop.Id
                where inv.UserId == userId
                group new { inv, prop } by new { inv.PropertyId, prop.Title } into g
                select new
                {
                    PropertyId = g.Key.PropertyId,
                    PropertyTitle = g.Key.Title,
                    TotalShares = g.Sum(x => x.inv.Shares),
                    TotalInvested = g.Sum(x => x.inv.InvestedAmount)
                }
            ).ToListAsync();

            return Ok(result);
        }

        [HttpPost("{id}/upload-image")]
        public async Task<IActionResult> UploadBase64(Guid id, [FromBody] UploadImageRequest request)
        {
            var property = await _context.Properties.FindAsync(id);
            if (property == null) return NotFound(new { message = "Property not found" });

            if (string.IsNullOrEmpty(request.Base64Image))
                return BadRequest(new { message = "No image provided" });

            property.ImageBase64 = request.Base64Image;
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later
                Action = "UploadBase64",
                Details = "Image loaded, property id: " + id.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Image stored in database" });
        }

        //[HttpPut("{id}")]
        //public async Task<IActionResult> UpdateProperty(Guid id, [FromBody] Property updated)
        //{
        //    var existing = await _context.Properties.FindAsync(id);
        //    if (existing == null) return NotFound();


        //    if (updated.TotalShares <= 0)
        //        return BadRequest(new { message = "TotalShares must be greater than 0" });

        //    if (updated.AvailableShares < 0)
        //        return BadRequest(new { message = "AvailableShares cannot be negative" });

        //    if (updated.AvailableShares > updated.TotalShares)
        //        return BadRequest(new { message = "AvailableShares cannot exceed TotalShares" });

        //    if (updated.Price <= 0)
        //        return BadRequest(new { message = "Price must be positive" });

        //    var sharePrice = updated.Price / updated.TotalShares;
        //    if (sharePrice < 1000)
        //        return BadRequest(new { message = $"Share price (${sharePrice:F2}) is too low. Must be at least $1000." });


        //    existing.Title = updated.Title;
        //    existing.Location = updated.Location;
        //    existing.Price = updated.Price;
        //    existing.TotalShares = updated.TotalShares;
        //    existing.UpfrontPayment = updated.UpfrontPayment;
        //    existing.ApplicationDeadline = updated.ApplicationDeadline;
        //    existing.Latitude = updated.Latitude;
        //    existing.Longitude = updated.Longitude;
        //    existing.BuybackPricePerShare = updated.BuybackPricePerShare;
        //    existing.RealPrice = updated.RealPrice;
        //    _context.ActionLogs.Add(new ActionLog
        //    {
        //        UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later
        //        Action = "UpdateProperty",
        //        Details = "Update Property id: " + id.ToString()
        //    });
        //    await _context.SaveChangesAsync();
        //    return Ok(new { message = "Property updated" });
        //}


        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteProperty(Guid id)
        {
            var property = await _context.Properties.FindAsync(id);
            if (property == null) return NotFound(new { message = "Property not found" });

            bool hasInvestments = await _context.Investments.AnyAsync(i => i.PropertyId == id);
            if (hasInvestments)
                return BadRequest(new { message = "Cannot delete property with active investments. Please delete them first." });


            _context.Properties.Remove(property);
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later
                Action = "DeleteProperty",
                Details = "Delete Property id: " + id.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Property deleted" });
        }

        [HttpGet("{propertyId}/images")]
        public async Task<IActionResult> GetPropertyImages(Guid propertyId)
        {
            var images = await _context.PropertyImages
                .Where(i => i.PropertyId == propertyId)
                .OrderByDescending(i => i.CreatedAt)
                .ToListAsync();

            return Ok(images);
        }

        [HttpPost("{propertyId}/images")]
        public async Task<IActionResult> UploadImage(Guid propertyId, [FromBody] UploadImageRequest request)
        {
            if (string.IsNullOrEmpty(request.Base64Image))
                return BadRequest(new { message = "No image provided" });

            _context.PropertyImages.Add(new PropertyImage
            {
                PropertyId = propertyId,
                Base64Data = request.Base64Image
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = "Image uploaded" });
        }

        [HttpDelete("images/{imageId}")]
        public async Task<IActionResult> DeleteImage(Guid imageId)
        {
            var img = await _context.PropertyImages.FindAsync(imageId);
            if (img == null) return NotFound();

            _context.PropertyImages.Remove(img);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Deleted" });
        }

        [HttpPost("{id}/change-listing-type")]
        public async Task<IActionResult> ChangeListingType(Guid id, [FromBody] string listingType)
        {
            if (listingType != "sale" && listingType != "rent")
                return BadRequest(new { message = "Invalid listing type" });

            var property = await _context.Properties.FindAsync(id);
            if (property == null) return NotFound(new { message = "Property not found" });

            property.ListingType = listingType;
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo fix
                Action = "ChangeListingType",
                Details = $"Changed listing type to {listingType} for property {id}"
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = "Listing type updated" });
        }

        [HttpPost("{propertyId}/validate-payments")]
        public async Task<IActionResult> ValidatePayments(Guid propertyId)
        {
            var property = await _context.Properties.FindAsync(propertyId);
            if (property == null)
                return NotFound(new { message = "Property not found" });

            // Protection: if already sold or rented out - nothing is done.
            if (property.Status == "sold" || property.Status == "rented")
            {
                return Ok(new { message = $"No action needed. Property already {property.Status}." });
            }

            var plans = await _context.PaymentPlans
                .Where(p => p.PropertyId == propertyId)
                .OrderBy(p => p.DueDate)
                .ToListAsync();

            if (!plans.Any())
                return NotFound(new { message = "No payment plans found." });

            bool hasOverdue = plans.Any(plan => plan.DueDate < DateTime.UtcNow && plan.Outstanding > 0);

            if (!hasOverdue)
            {
                return Ok(new { message = "All payments are valid." });
            }

            // change status to "declined"
            property.Status = "declined";

            // search all investments on this property
            var investments = await _context.Investments
                .Where(i => i.PropertyId == propertyId)
                .ToListAsync();

            decimal totalRefunded = 0m;
            int investmentsRefunded = 0;

            foreach (var inv in investments)
            {
                var user = await _context.Users.FindAsync(inv.UserId);
                if (user != null)
                {
                    user.WalletBalance += inv.InvestedAmount;
                    totalRefunded += inv.InvestedAmount;
                    investmentsRefunded++;

                    _context.ActionLogs.Add(new ActionLog
                    {
                        UserId = inv.UserId,
                        Action = "InvestmentRefundedDueToDecline",
                        Details = $"Refunded {inv.InvestedAmount} USD for investment {inv.Id} on declined property {propertyId}"
                    });
                }
            }

            _context.Investments.RemoveRange(investments);

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo admin GUID
                Action = "PropertyDeclinedDueToPaymentFailure",
                Details = $"Property {property.Title} ({property.Id}) declined. Refunded {investmentsRefunded} investments totaling {totalRefunded} USD."
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Property declined and investments refunded.",
                totalRefunded,
                investmentsRefunded
            });
        }


        [HttpGet("with-stats")]
        //[Authorize(Roles = "admin")] todo пока убрал тк нужен для приоритетного инестора для страницы юзера
        public async Task<IActionResult> GetPropertiesWithStats()
        {
            var now = DateTime.UtcNow;
            try
            {
                var properties = await _context.Properties
                   .Include(p => p.PaymentPlans).ToListAsync();

                var data = properties.Select(p => new
                {
                    p.Id,
                    p.Title,
                    p.Status,
                    p.Location,
                    p.Price,
                    p.RealPrice,
                    p.TotalShares,
                    p.AvailableShares,
                    p.ListingType,
                    p.ImageBase64,
                    p.ExpectedCompletionDate,
                    p.UpfrontPayment,
                    p.ApplicationDeadline,
                    p.CreatedAt,
                    p.MonthlyRentalIncome,
                    p.LastPayoutDate,
                    p.BuybackPricePerShare,
                    p.Latitude,
                    p.Longitude,
                    p.VideoUrl,
                    CurrentStep = p.PaymentPlans
                           .Where(pp => pp.DueDate > now)
                           .OrderBy(pp => pp.DueDate)
                           .Select((pp, index) => new { Step = index + 1, pp.DueDate })
                           .FirstOrDefault(),

                    PriorityInvestorId = p.PriorityInvestorId,

                    ApplicationsCount = _context.InvestmentApplications
                           .Count(a => a.PropertyId == p.Id && a.Status == null),

                    ApplicationsAmount = _context.InvestmentApplications
                           .Where(a => a.PropertyId == p.Id && a.Status == null)
                           .Sum(a => (decimal?)a.RequestedAmount) ?? 0,

                    ApprovedShares = _context.Investments
                           .Where(i => i.PropertyId == p.Id)
                           .Sum(i => (int?)i.Shares) ?? 0
                })
                   .ToList();

                return Ok(data);
            }
            catch (Exception ex)
            {
                return BadRequest(ex);
            }

        }

        [HttpGet("{id}/buyback-price")]
        public async Task<IActionResult> GetBuybackPrice(Guid id)
        {
            var property = await _context.Properties.FindAsync(id);
            if (property == null) return NotFound();
            return Ok(new { buybackPrice = property.BuybackPricePerShare });
        }

        // todo move
        public class RentPayoutRequest
        {
            public decimal? CustomAmount { get; set; }
        }

        [HttpPost("{propertyId}/pay-rent")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> PayRentalIncome(Guid propertyId, [FromBody] RentPayoutRequest request)
        {
            var property = await _context.Properties.FindAsync(propertyId);
            if (property == null) return NotFound(new { message = "Property not found" });

            var totalShares = property.TotalShares;
            if (totalShares <= 0)
                return BadRequest(new { message = "Property has invalid number of shares." });

            decimal amountToDistribute = request.CustomAmount ?? property.MonthlyRentalIncome;

            if (amountToDistribute <= 0)
                return BadRequest(new { message = "Payout amount must be greater than zero." });

            var investments = await _context.Investments
                .Where(i => i.PropertyId == propertyId)
                .ToListAsync();

            if (!investments.Any())
                return BadRequest(new { message = "No investors found for this property." });

            // Распределение
            var payoutPerShare = amountToDistribute / totalShares;

            foreach (var inv in investments)
            {
                var payout = Math.Round(payoutPerShare * inv.Shares, 2);
                var user = await _context.Users.FindAsync(inv.UserId);
                if (user == null) continue;

                user.WalletBalance += payout;

                // log
                _context.ActionLogs.Add(new ActionLog
                {
                    UserId = inv.UserId,
                    Action = "MonthlyRentPayout",
                    Details = $"User received {payout} USD rent for property '{property.Title}' ({property.Id})."
                });

                // сообщение
                _context.Messages.Add(new Message
                {
                    RecipientId = inv.UserId,
                    Title = $"💸 Rental income received: {payout} USD",
                    Content = $"You have received rent payout for property \"{property.Title}\".\nAmount: {payout} USD."
                });

                var tokens = await _context.FcmDeviceTokens
               .Where(t => t.UserId == inv.UserId)
               .Select(t => t.Token).ToListAsync();
                foreach (var token in tokens)
                {
                    await _firebaseNotificationService.SendNotificationAsync(token, $"💰 Rent income", $"You received {payout} USD for \"{property.Title}\"");
                }

                _context.UserTransactions.Add(new UserTransaction
                {
                    Id = Guid.NewGuid(),
                    UserId = inv.UserId,
                    Type = TransactionType.RentIncome,
                    Amount = payout,
                    Timestamp = DateTime.UtcNow,
                    Notes = $"Rental income for property '{property.Title}'"
                });


            }


            property.LastPayoutDate = DateTime.UtcNow;

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = User.GetUserId(),
                Action = "AdminRentPayout",
                Details = $"Admin distributed {amountToDistribute} USD for property '{property.Title}'"
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = "Payout completed" });
        }

        [HttpGet("{propertyId}/rent-history")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> GetRentPayoutHistory(Guid propertyId, [FromQuery] string? userId, [FromQuery] string? fullName, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            var property = await _context.Properties.FindAsync(propertyId);
            if (property == null)
                return NotFound(new { message = "Property not found" });

            var logsQuery = _context.ActionLogs
                .Where(l => l.Action == "MonthlyRentPayout" && l.Details.Contains(propertyId.ToString()));

            if (!string.IsNullOrEmpty(userId) && Guid.TryParse(userId, out var uid))
                logsQuery = logsQuery.Where(l => l.UserId == uid);

            if (from.HasValue)
                logsQuery = logsQuery.Where(l => l.Timestamp >= from.Value);
            if (to.HasValue)
                logsQuery = logsQuery.Where(l => l.Timestamp <= to.Value);

            var logs = await logsQuery
                .OrderByDescending(l => l.Timestamp)
                .ToListAsync();

            var userIds = logs.Select(l => l.UserId).Distinct().ToList();
            var users = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.FullName);

            var result = logs
                .Select(log =>
                {
                    var name = users.ContainsKey(log.UserId) ? users[log.UserId] : log.UserId.ToString();
                    var amount = 0m;

                    var match = System.Text.RegularExpressions.Regex.Match(log.Details, @"received (\d+(\.\d+)?) USD");
                    if (match.Success)
                        decimal.TryParse(match.Groups[1].Value, out amount);

                    return new
                    {
                        fullName = name,
                        amount,
                        log.Timestamp
                    };
                })
                .Where(r => string.IsNullOrEmpty(fullName) || r.fullName.Contains(fullName, StringComparison.OrdinalIgnoreCase))
                .ToList();

            return Ok(result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateProperty(Guid id, [FromBody] Property updated,
    [FromServices] IModerationService moderation, [FromServices] AppDbContext db)
        {
            var existing = await _context.Properties.FindAsync(id);
            if (existing == null) return NotFound();

            // общие валидации (как у вас сейчас) — оставляем

            var userId = User.GetUserId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            var canDirectPrice = user?.Permissions.Has(PermissionFlags.ApprovePropertyPriceChange) == true;

            // ======== обработка цены ========
            if (updated.Price != existing.Price)
            {
                if (canDirectPrice)
                {
                    existing.Price = updated.Price;
                }
                else
                {
                    // создаём заявку и НЕ меняем existing.Price
                    var req =   await moderation.CreateOrReturnPendingAsync(
                        ChangeTarget.Property, id, "Price",
                        oldValue: existing.Price.ToString(System.Globalization.CultureInfo.InvariantCulture),
                        newValue: updated.Price.ToString(System.Globalization.CultureInfo.InvariantCulture),
                        requestedBy: userId
                    );

                    // всё остальное (неценовые поля) обновим, а цену — нет
                }
            }

            // ======== прочие поля можно менять сразу (или тоже увести в модерацию по мере надобности) ========
            existing.Title = updated.Title;
            existing.Location = updated.Location;
            existing.TotalShares = updated.TotalShares;
            existing.AvailableShares = updated.AvailableShares;
            existing.UpfrontPayment = updated.UpfrontPayment;
            existing.ApplicationDeadline = updated.ApplicationDeadline;
            existing.Latitude = updated.Latitude;
            existing.Longitude = updated.Longitude;
            existing.BuybackPricePerShare = updated.BuybackPricePerShare;
            existing.RealPrice = updated.RealPrice;
            existing.ExpectedCompletionDate = updated.ExpectedCompletionDate;
            existing.MonthlyRentalIncome = updated.MonthlyRentalIncome;
            existing.LastPayoutDate = updated.LastPayoutDate;
            existing.ListingType = updated.ListingType;
            existing.VideoUrl = updated.VideoUrl;

            await _context.SaveChangesAsync();

            // Если заявка была создана — вернём 202, иначе 200
            if (!canDirectPrice && updated.Price != existing.Price)
                return Accepted(new { message = "Price change sent for moderation" }); // , requestId = req.Id

            return Ok(new { message = "Property updated" });
        }

        // todo move
        public class UpdateVideoUrlRequest
        {
            public string? VideoUrl { get; set; }
        }

        [HttpPost("{id}/video-url")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> SetVideoUrl(Guid id, [FromBody] UpdateVideoUrlRequest request)
        {
            var property = await _context.Properties.FindAsync(id);
            if (property == null)
                return NotFound(new { message = "Property not found" });
             
            if (!string.IsNullOrWhiteSpace(request.VideoUrl) &&
                !request.VideoUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "VideoUrl must be a valid URL" });
            }

            property.VideoUrl = string.IsNullOrWhiteSpace(request.VideoUrl)
                ? null           
                : request.VideoUrl.Trim();

            _context.ActionLogs.Add(new ActionLog
            {
                UserId = User.GetUserId(),
                Action = "SetPropertyVideoUrl",
                Details = $"Property {property.Title} ({property.Id}) video url set to '{property.VideoUrl}'"
            });

            await _context.SaveChangesAsync();

            return Ok(new { message = "Video URL updated" });
        }


        [HttpGet("{propertyId}/media")]
        public async Task<IActionResult> GetMedia(Guid propertyId)
        {
            var media = await _context.PropertyMedias
                .Where(m => m.PropertyId == propertyId)
                .OrderByDescending(m => m.CreatedAt)
                 .Select(m => new
                 {
                     m.Id,
                     m.PropertyId,
                     m.Type,
                     m.Base64Data,
                     Url = m.Url, // NormalizeMediaUrl(m.Url),
                     m.CreatedAt,
                     m.FileName,
                     m.ContentType,
                     m.Size
                 })
                .ToListAsync();

            return Ok(media);
        }

        [HttpPost("{propertyId}/media/upload")]
        [Authorize(Roles = "admin")]
        [RequestSizeLimit(200_000_000)] // 200MB
        public async Task<IActionResult> UploadMedia(Guid propertyId, [FromForm] IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded" });

            var property = await _context.Properties.FindAsync(propertyId);
            if (property == null)
                return NotFound(new { message = "Property not found" });

            var contentType = file.ContentType?.ToLower() ?? "";
            var isVideo = contentType.StartsWith("video/");
            var isImage = contentType.StartsWith("image/");

            //var allowedVideo = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".mp4", ".mov", ".webm", };
            //var allowedImage = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp" };

            var ext = Path.GetExtension(file.FileName);
            //if (isVideo && !allowedVideo.Contains(ext))
            //    return BadRequest(new { message = $"Video extension not allowed: {ext}. Allowed: {string.Join(", ", allowedVideo)}" });

            //if (isImage && !allowedImage.Contains(ext))
            //    return BadRequest(new { message = $"Image extension not allowed: {ext}. Allowed: {string.Join(", ", allowedImage)}" });
              
            //if (!isVideo && !isImage)
            //    return BadRequest(new { message = "Only image/* or video/* allowed" });

            // ✅ путь из конфига
            var uploadsRoot = _config["App:UploadsRoot"]?.Trim();
            if (string.IsNullOrWhiteSpace(uploadsRoot))
                uploadsRoot = Path.Combine(AppContext.BaseDirectory, "uploads"); // fallback

            var dir = Path.Combine(uploadsRoot, propertyId.ToString());
            Directory.CreateDirectory(dir);

            var fileName = $"{Guid.NewGuid()}{ext}";
            var fullPath = Path.Combine(dir, fileName);

            // 🔎 логируем
            _logger.LogInformation("UploadMedia: propertyId={PropertyId}, originalName={OriginalName}, ct={ContentType}, len={Len}, fullPath={FullPath}",                propertyId, file.FileName, file.ContentType, file.Length, fullPath);

            await using (var stream = System.IO.File.Create(fullPath))
                await file.CopyToAsync(stream);

                // ✅ baseUrl из конфига (важно для эмулятора)
                var baseUrl = _config["PublicBaseUrlHdd"]?.TrimEnd('/');
                if (string.IsNullOrWhiteSpace(baseUrl))
                    baseUrl = $"{Request.Scheme}://{Request.Host}";

                var url = $"{baseUrl}/uploads/{propertyId}/{fileName}";

                // форсим https
                if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
                    url = "https://" + url.Substring("http://".Length);

                var entity = new PropertyMedia
                {
                    PropertyId = propertyId,
                    Type = isVideo ? MediaType.Video : MediaType.Image,
                    Url = url,
                    FileName = file.FileName,
                    ContentType = file.ContentType,
                    Size = file.Length
                };

                _context.PropertyMedias.Add(entity);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = "Uploaded",
                    id = entity.Id,
                    url,
                    storedAs = new { fullPath, uploadsRoot, fileName },
                    meta = new { file.FileName, file.ContentType, file.Length }
                });
            }
            catch (Exception ex)
            {
               _logger.LogError(ex, "UploadMedia failed for propertyId={PropertyId}", propertyId);
                return StatusCode(500, new
                {
                    message = "Upload failed",
                    error = ex.Message,
                    type = ex.GetType().FullName
                });
            }
        }

        [HttpDelete("media/{mediaId}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> DeleteMedia(Guid mediaId)
        {
            var media = await _context.PropertyMedias.FindAsync(mediaId);
            if (media == null) return NotFound();

            // 1) вычисляем path (/uploads/...)
            string? path = null;

            if (!string.IsNullOrWhiteSpace(media.Url))
            {
                if (Uri.TryCreate(media.Url, UriKind.Absolute, out var abs))
                    path = abs.AbsolutePath; // "/uploads/<propertyId>/<file>"
                else
                    path = media.Url;        // может быть "/uploads/..."
            }

            // 2) удаляем файл если это наш /uploads
            if (!string.IsNullOrEmpty(path) && path.StartsWith("/uploads/"))
            {
                var relative = path.Replace("/uploads/", "").TrimStart('/');
                var filePath = Path.Combine("/var/data/uploads",
                    relative.Replace("/", Path.DirectorySeparatorChar.ToString()));

                try
                {
                    if (System.IO.File.Exists(filePath))
                        System.IO.File.Delete(filePath);
                }
                catch (Exception ex)
                {
                    return BadRequest(new { message = "Failed to delete file", details = ex.Message });
                }
            }

            // 3) удаляем запись
            _context.PropertyMedias.Remove(media);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Deleted" });
        }

        // todo test
        [HttpGet("debug-files")]
        [AllowAnonymous]
        public IActionResult DebugFiles()
        {
            var uploadsRoot = _config["App:UploadsRoot"];
            var files = Directory.GetFiles(uploadsRoot ?? "");
            return Ok(new { uploadsRoot, files });
        }

        // todo fix
        //private string NormalizeMediaUrl(string? url)
        //{
        //    if (string.IsNullOrWhiteSpace(url)) return url ?? "";

        //    url = url.Trim();

        //    // если вдруг в БД попал http — форсим https
        //    if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
        //        url = "https://" + url.Substring("http://".Length);

        //    return url;
        //}



    }
}
