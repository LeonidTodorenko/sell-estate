using System.ComponentModel.DataAnnotations;

namespace RealEstateInvestment.Models
{
    public class SystemSetting
    {
        [Key]
        public string Key { get; set; } = string.Empty;

        public string Value { get; set; } = string.Empty;
    }

}
