using System.Linq.Expressions;

namespace RealEstateInvestment.Services;

public sealed class CapitalPosition
{
    public decimal Price { get; set; }
    public int TotalShares { get; set; }
    public int Shares { get; set; }
    public decimal MissingPriceValue { get; set; }
}

public static class CapitalSnapshotMath
{
    public static readonly Expression<Func<CapitalPosition, decimal>> Value =
        p => p.TotalShares > 0 ? p.Price / p.TotalShares * p.Shares : p.MissingPriceValue;

    public static decimal Total(decimal wallet, decimal investment) => wallet + investment;

    public static string Commentary(bool previous, bool russian) => previous
        ? russian ? "Изменение капитала рассчитано относительно предыдущего сохранённого снимка. Кошелёк включает зачисленную аренду."
            : "Capital change compares the previous saved snapshot. The wallet includes credited rent."
        : russian ? "Первоначальный снимок на фактическую дату. Предыдущий снимок отсутствует."
            : "Initial snapshot at the actual capture date. A previous snapshot is unavailable.";
}
