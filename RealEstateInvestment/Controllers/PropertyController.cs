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

        public PropertyController(AppDbContext context)
        {
            _context = context;
        }

        // ✅ Получить список объектов недвижимости
        [HttpGet]
        public async Task<IActionResult> GetProperties()
        {
            var properties = await _context.Properties.ToListAsync();
            return Ok(properties);
        }

        // ✅ Добавить объект недвижимости
        [HttpPost]
        public async Task<IActionResult> CreateProperty([FromBody] Property property)
        {
            property.AvailableShares = property.TotalShares;
            _context.Properties.Add(property);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Объект добавлен" });
        }

        // ✅ Изменить статус объекта (продано, в аренде)
        [HttpPost("{id}/change-status")]
        public async Task<IActionResult> ChangePropertyStatus(Guid id, [FromBody] string status)
        {
            if (status != "available" && status != "sold" && status != "rented")
                return BadRequest(new { message = "Неверный статус" });

            var property = await _context.Properties.FindAsync(id);
            if (property == null) return NotFound(new { message = "Объект не найден" });

            property.Status = status;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Статус обновлён" });
        }
    }
}
