// Same currency default as InvestorApp/src/utils/format.ts.
export const money = (value?: number | null) => value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
export const date = (value?: string | null) => !value || !Number.isFinite(Date.parse(value)) ? '—' : new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
export function imageUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[A-Za-z0-9+/=\s]+$/.test(raw)) return `data:image/jpeg;base64,${raw}`;
  return undefined;
}
export const safeLink = (raw?: string | null) => raw && /^https?:\/\//i.test(raw) ? raw : undefined;
