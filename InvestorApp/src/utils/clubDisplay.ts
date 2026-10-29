// API fractions stay precise (including zero); missing financial values remain unknown.
export function clubPercent(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${Number((value * 100).toFixed(4))}%`
    : 'Unavailable';
}
