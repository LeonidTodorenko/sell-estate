import type { HistoryPoint, RentalEntry } from './investor-contracts.ts';

export type ChartRange = '3m' | '6m' | '1y' | 'all';

export function cleanHistory(points: HistoryPoint[] = []) {
  return points.filter(p => Number.isFinite(Date.parse(p.date)) && Number.isFinite(p.total))
    .slice().sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

// Finance in InvestorApp anchors periods to the latest available observation.
export function rangeHistory(points: HistoryPoint[], range: ChartRange) {
  const sorted = cleanHistory(points);
  if (!sorted.length || range === 'all') return sorted;
  const end = new Date(sorted[sorted.length - 1].date);
  const start = new Date(end);
  const day = start.getUTCDate();
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - (range === '3m' ? 3 : range === '6m' ? 6 : 12));
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  start.setUTCDate(Math.min(day, lastDay));
  return sorted.filter(p => Date.parse(p.date) >= start.getTime());
}

export function monthlyRent(entries: RentalEntry[]) {
  const months = new Map<string, number>();
  for (const entry of entries) {
    if (!Number.isFinite(Date.parse(entry.timestamp)) || !Number.isFinite(entry.amount)) continue;
    const key = new Date(entry.timestamp).toISOString().slice(0, 7);
    months.set(key, (months.get(key) || 0) + entry.amount);
  }
  return [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ date: `${month}-01`, total }));
}

export interface Allocation { label: string; value: number }
export function validAllocation(items: Allocation[]) {
  return items.filter(item => Number.isFinite(item.value) && item.value > 0);
}
