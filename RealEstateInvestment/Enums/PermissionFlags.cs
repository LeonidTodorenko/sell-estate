namespace RealEstateInvestment.Enums
{
    [Flags]
    public enum PermissionFlags : long
    {
        None = 0,
        ApprovePropertyPriceChange = 1 << 0,
        ApprovePropertyFields = 1 << 1,
        ApproveKyc = 1 << 2,
    }



}
