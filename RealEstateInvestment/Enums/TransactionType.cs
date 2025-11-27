namespace RealEstateInvestment.Enums
{
    public enum TransactionType
    {
        Investment,
        Buyback,
        ShareMarketBuy,
        ShareMarketSell,
        Deposit,
        Withdrawal,
        RentIncome,
        ReferralCodePurchase,

        ReferralReward,   // реферальный бонус пригласителю
        ClubFeeIncome     // клубная комиссия, которая идёт суперпользователю
    }
}
