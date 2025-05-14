using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/properties")]
    public class PropertyController : ControllerBase
    {
        private readonly AppDbContext _context;

        public class UploadImageRequest
        {
            public string Base64Image { get; set; }
        }

        public PropertyController(AppDbContext context)
        {
            _context = context;
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
            property.AvailableShares = property.TotalShares;
            // property.ApplicationDeadline = DateTime.SpecifyKind(property.ApplicationDeadline, DateTimeKind.Utc);

            try
            {
                _context.Properties.Add(property);
                 _context.ActionLogs.Add(new ActionLog
                {
                    UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                    Action = "CreateProperty",
                    Details = "Property created: " + property.Title
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
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
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
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                Action = "UploadBase64",
                Details = "Image loaded, property id: " + id.ToString()
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Image stored in database" });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateProperty(Guid id, [FromBody] Property updated)
        {
            var existing = await _context.Properties.FindAsync(id);
            if (existing == null) return NotFound();

            existing.Title = updated.Title;
            existing.Location = updated.Location;
            existing.Price = updated.Price;
            existing.TotalShares = updated.TotalShares;
            existing.UpfrontPayment = updated.UpfrontPayment;
            existing.ApplicationDeadline = updated.ApplicationDeadline;
            existing.Latitude = updated.Latitude;
            existing.Longitude = updated.Longitude;
            _context.ActionLogs.Add(new ActionLog
            {
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
                Action = "UpdateProperty",
                Details = "Update Property id: " + id.ToString()
            });
            await _context.SaveChangesAsync();
            return Ok(new { message = "Property updated" });
        }


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
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
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
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo fix
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
                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo admin GUID
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



    }
}
