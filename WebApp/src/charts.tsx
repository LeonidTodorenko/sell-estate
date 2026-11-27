import { useId, useState } from 'react';
import { money } from './format';
import { Empty, Resource, useResource } from './ui';
import { investorPaths, type FinanceStats, type HistoryPoint } from './investor-contracts';
import { cleanHistory, rangeHistory, validAllocation, type Allocation, type ChartRange } from './chart-data';
import type { Holding, Session, Totals } from './types';

const colors = ['#087a4e', '#3c91a0', '#a66b2b', '#7b6ab1'];
const labelDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(value));

export function HistoryChart({ title, points, bars = false, description }: { title: string; points?: HistoryPoint[]; bars?: boolean; description?: string }) {
  const [range, setRange] = useState<ChartRange>('1y');
  const id = useId();
  const rows = rangeHistory(points || [], range);
  const all = cleanHistory(points);
  const min = Math.min(0, ...rows.map(p => p.total));
  const max = Math.max(0, ...rows.map(p => p.total));
  const span = max - min || 1;
  const x = (i: number) => 85 + (rows.length === 1 ? 267 : i / (rows.length - 1) * 535);
  const y = (value: number) => 190 - (value - min) / span * 160;
  const line = rows.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.total)}`).join(' ');
  const baseline = y(0);
  return <section className="panel analytics-card">
    <div className="section-heading"><div><h2>{title}</h2>{description && <p className="muted">{description}</p>}</div><div className="chart-ranges" role="group" aria-label={`${title} period`}>{(['3m', '6m', '1y', 'all'] as const).map(r => <button key={r} aria-pressed={r === range} onClick={() => setRange(r)}>{r === 'all' ? 'All' : r.toUpperCase()}</button>)}</div></div>
    {!rows.length ? <Empty title={all.length ? 'No chart data for selected period' : 'No historical data yet'}>{all.length ? <>Choose a wider period to see available observations. <button className="text-button" onClick={() => setRange('all')}>Show all history</button></> : bars ? 'Recorded payouts will appear here by month. If dates are filtered, try a wider date range.' : 'The API has not returned valid historical observations. This chart will appear when history is available; current balances may still be shown above.'}</Empty> : <>
      <div className="chart-summary"><strong>{money(bars ? rows.reduce((sum, p) => sum + p.total, 0) : rows[rows.length - 1].total)}</strong><span>{bars ? 'Received in period' : 'Latest historical value'} · {labelDate(rows[0].date)} – {labelDate(rows[rows.length - 1].date)}</span></div>
      <svg className="analytics-chart" viewBox="0 0 640 225" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>{title}: {rows.length} observations. Exact values in the data table below.</title>
        {[0, 1, 2, 3].map(i => { const value = min + span * i / 3; return <g key={i}><line x1="85" x2="620" y1={y(value)} y2={y(value)} stroke="#dce7e1"/><text x="78" y={y(value) + 4} textAnchor="end">{new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}</text></g>; })}
        {bars ? rows.map((p, i) => { const width = Math.min(42, 470 / rows.length); const center = 85 + (i + .5) / rows.length * 535; return <rect key={`${p.date}-${i}`} x={center - width / 2} y={Math.min(y(p.total), baseline)} width={width} height={Math.abs(y(p.total) - baseline)} rx="3" fill="#087a4e"><title>{labelDate(p.date)}: {money(p.total)}</title></rect>; }) : <><path d={`${line} L${x(rows.length - 1)},${baseline} L${x(0)},${baseline} Z`} fill="#11a36a" opacity=".1"/><path d={line} stroke="#087a4e" strokeWidth="3" fill="none" vectorEffect="non-scaling-stroke"/>{rows.map((p, i) => <circle key={`${p.date}-${i}`} cx={x(i)} cy={y(p.total)} r="3" fill="#087a4e"><title>{p.date}: {money(p.total)}</title></circle>)}</>}
        <text x="85" y="218">{labelDate(rows[0].date)}</text><text x="620" y="218" textAnchor="end">{labelDate(rows[rows.length - 1].date)}</text>
      </svg>
      <details className="chart-data"><summary>View chart data</summary><div className="table-wrap"><table><thead><tr><th>Date (UTC)</th><th>Amount (USD)</th></tr></thead><tbody>{rows.map((p, i) => <tr key={`${p.date}-${i}`}><td>{p.date.slice(0, 10)}</td><td>{money(p.total)}</td></tr>)}</tbody></table></div></details>
    </>}
    {!!all.length && <p className="chart-note">Periods end at the latest available observation. {bars ? 'Only months with recorded payouts are shown.' : 'Historical account activity includes contributions and withdrawals; changes are not an investment return.'}</p>}
  </section>;
}

export function AllocationChart({ title, items, description }: {
  title: string; items: Allocation[]; description?: string;
}) {
  const id = useId();
  const [selection, setSelection] = useState<number>();
  const rows = validAllocation(items).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const negative = items.filter(item => Number.isFinite(item.value) && item.value < 0);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const selected = selection === undefined ? undefined : rows[selection];
  const percent = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'percent', maximumFractionDigits: 1,
  }).format(value / total);
  let offset = 0;

  return <section className="panel analytics-card" aria-labelledby={id}>
    <h2 id={id}>{title}</h2>
    {description && <p className="muted">{description}</p>}
    {rows.length ? <div className="allocation-content">
      <div className="allocation-visual">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          {rows.map((row, i) => {
            const length = row.value / total * 100;
            const start = offset;
            offset += length;
            return <circle key={i} cx="60" cy="60" r="47" pathLength="100"
              fill="none" stroke={colors[i % colors.length]} strokeWidth={selection === i ? 22 : 18}
              strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start}
              transform="rotate(-90 60 60)" onClick={() => setSelection(i)}
              style={{ cursor: 'pointer' }}/>;
          })}
        </svg>
        <p className="allocation-selection" aria-live="polite">
          <span>{selected?.label ?? 'Positive total'}</span>
          <strong>{money(selected?.value ?? total)}</strong>
          {selected && <span>{percent(selected.value)}</span>}
        </p>
      </div>
      <ul className="allocation-legend">
        {rows.map((row, i) => <li key={i}><button type="button" aria-pressed={i === selection}
          onClick={() => setSelection(i)}>
          <span className="allocation-label"><i aria-hidden="true" style={{ background: colors[i % colors.length] }}/>{row.label}</span>
          <strong>{money(row.value)} <small>({percent(row.value)})</small></strong>
        </button></li>)}
      </ul>
    </div> : <Empty title="No positive amounts available"/>}
    {!!negative.length && <div><h3>Negative amounts</h3>
      <dl className="allocation-negative">{negative.map((row, i) => <div key={i}><dt>{row.label}</dt><dd>{money(row.value)}</dd></div>)}</dl>
    </div>}
  </section>;
}

export function DashboardHistory({ session }: { session: Session }) {
  const history = useResource<FinanceStats>(investorPaths(session).finance);
  return <Resource resource={history}>{data => <HistoryChart title="Total Assets · History" points={data.combinedHistory} description="Combined equity and rental income history, as in the mobile app. Current totals above use today's asset valuation."/>}</Resource>;
}

export function AssetStructure({ session }: { session: Session }) {
  const totals = useResource<Totals>(`/users/${encodeURIComponent(session.user.id)}/total-assets`);
  return <Resource resource={totals}>{data => <AssetStructureChart data={data}/>}</Resource>;
}

export function AssetStructureChart({ data }: { data: Totals }) {
  const items = [
    { label: 'Wallet', value: data.walletBalance },
    { label: 'Investments', value: data.investmentValue },
    { label: 'Pending applications', value: data.pendingApplicationsValue },
    { label: 'Marketplace', value: data.marketValue },
  ];
  if (items.some(item => item.value == null || !Number.isFinite(item.value))) {
    return <section className="panel"><h2>Asset structure</h2>
      <Empty title="Asset breakdown unavailable">Some components are missing from the API response.</Empty>
    </section>;
  }
  return <AllocationChart title="Asset structure" items={items.map(item => ({ label: item.label, value: item.value! }))}
    description="Current asset values in USD. The wallet already includes credited rental payouts."/>;
}

export function PortfolioAllocation({ data }: { data: Holding[] }) {
  const items = data.map(p => ({ label: p.propertyTitle || p.propertyId, value: p.totalShareValue }));
  return <AllocationChart title="Portfolio by property" items={items}
    description="Combined share value per property in USD, including pending shares returned by the API."/>;
}
