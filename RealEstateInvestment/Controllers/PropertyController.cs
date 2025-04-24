using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
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

    }
}
