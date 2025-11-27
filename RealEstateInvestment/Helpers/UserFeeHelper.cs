using RealEstateInvestment.Enums;

namespace RealEstateInvestment.Helpers
{
    public static class UserFeeHelper
    {
        // 1) Статус по totalAssets
        public static UserClubStatus GetStatus(decimal totalAssets)
        {
            if (totalAssets >= 1_000_000m)
                return UserClubStatus.Diamond; // можно сделать отдельный Black, если захотите
            if (totalAssets >= 100_000m)
                return UserClubStatus.Diamond;
            if (totalAssets >= 50_000m)
                return UserClubStatus.Gold;
            if (totalAssets >= 10_000m)
                return UserClubStatus.Silver;

            return UserClubStatus.Blue;
        }

        // 2) Проценты комиссии (без кода / с кодом) по статусу
        public static (decimal baseFee, decimal withReferralFee) GetUserFeePercents(UserClubStatus status)
        {
            return status switch
            {
                UserClubStatus.Blue => (0.10m, 0.07m),
                UserClubStatus.Silver => (0.09m, 0.06m),
                UserClubStatus.Gold => (0.085m, 0.055m),
                UserClubStatus.Diamond => (0.08m, 0.05m),
                _ => (0.10m, 0.07m)
            };
        }

        // 3) Процент и срок реферальной награды для пригласившего
        public static (decimal percent, int years) GetReferrerRewardByTotal(decimal totalAssets)
        {
            if (totalAssets >= 1_000_000m)
                return (0.05m, 5);
            if (totalAssets >= 100_000m)
                return (0.03m, 3);
            if (totalAssets >= 50_000m)
                return (0.02m, 2);
            if (totalAssets >= 10_000m)
                return (0.01m, 1);

            return (0m, 0); // не должен сюда попадать, т.к. ниже 10k код генерить нельзя
        }
    }
}
