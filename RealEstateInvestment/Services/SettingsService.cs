using RealEstateInvestment.Data;

namespace RealEstateInvestment.Services
{
    public class SettingsService
    {
        private readonly AppDbContext _context;
        public SettingsService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<decimal> GetDecimalSetting(string key, decimal defaultValue)
        {
            var setting = await _context.SystemSettings.FindAsync(key);
            if (setting != null && decimal.TryParse(setting.Value, out var value))
                return value;
            return defaultValue;
        }
    }

}
