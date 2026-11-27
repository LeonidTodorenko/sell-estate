import { useEffect, useId, useRef, useState } from 'react';
import { money } from './format';
import { plotPath } from './forecast-data';

export type ForecastSeries = { label: string; color: string; dashed?: boolean; values: (number | null)[] };
export type ForecastPoint = { year: number; date: string };
export const forecastMoney = (value: number | null) => value === null ? 'Unknown' : money(value);
const compact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

export function ForecastChart({ title, description, points, series }: {
  title: string; description: string; points: ForecastPoint[]; series: ForecastSeries[];
}) {
  const id = useId();
  const [selected, setSelected] = useState(points.length - 1);
  const index = Math.min(selected, points.length - 1);
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(160, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const left = 60;
  const right = width - 14;
  const bottom = width < 440 ? 150 : 214;
  const values = series.flatMap(s => s.values.filter(v => v !== null));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const first = Date.parse(points[0].date);
  const duration = Date.parse(points[points.length - 1].date) - first || 1;
  const dateX = (date: string) => left + (Date.parse(date) - first) / duration * (right - left);
  const x = (i: number) => dateX(points[i].date);
  const y = (value: number) => bottom - (value - min) / span * (bottom - 20);

  return <section className="forecast-chart" aria-labelledby={id}>
    <h3 id={id}>{title}</h3><p className="chart-note">{description}</p>
    <ul className="forecast-legend">{series.map(s => <li key={s.label}>
      <i aria-hidden="true" style={{ borderColor: s.color, borderTopStyle: s.dashed ? 'dashed' : 'solid' }}/>{s.label}
    </li>)}</ul>
    {!values.length && <p className="note">No amounts can be calculated with the available inputs.</p>}
    <div className="forecast-plot" ref={plot}>{!!values.length && <svg viewBox={`0 0 ${width} ${bottom + 25}`} aria-hidden="true" onPointerMove={event => {
      if (event.pointerType !== 'mouse') return;
      const matrix = event.currentTarget.getScreenCTM();
      if (!matrix) return;
      const cursor = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()).x;
      setSelected(points.reduce((closest, _, i) => Math.abs(x(i) - cursor) < Math.abs(x(closest) - cursor) ? i : closest, 0));
    }}>
      {!!values.length && [...new Set([min, (min + max) / 2, max, 0])].map(tick => <g key={tick}>
        <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#879b91' : '#dce7e1'}/>
        <text x={left - 8} y={y(tick) + 4} textAnchor="end">{compact.format(tick)}</text>
      </g>)}
      <line x1={x(index)} x2={x(index)} y1="23" y2={bottom} stroke="#667f74" strokeDasharray="2 4"/>
      {series.map(s => <g key={s.label}>
        <path d={plotPath(s.values, x, y)} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? '6 4' : undefined} vectorEffect="non-scaling-stroke"/>
        {s.values.map((value, i) => value !== null && <circle key={i} cx={x(i)} cy={y(value)} r={i === index ? 5.5 : 3.5} stroke={s.color} strokeWidth="2" fill={s.dashed ? "#fff" : s.color}/>)}
      </g>)}
      <text x={left} y={bottom + 20}>Start</text>
      <text x={right} y={bottom + 20} textAnchor="end">Year {points.at(-1)?.year}</text>
    </svg>}</div>
    <div className="chart-ranges" role="group" aria-label={`${title} data points`}>
      {points.map((p, i) => <button type="button" key={p.year} aria-pressed={i === index}
        onFocus={() => setSelected(i)} onPointerMove={e => { if (e.pointerType === 'mouse') setSelected(i); }}
        onClick={() => setSelected(i)} aria-controls={`${id}-point`}>{p.year ? `Year ${p.year}` : 'Start'}</button>)}
    </div>
    <div className="forecast-point" id={`${id}-point`} aria-live="polite">
      <time dateTime={points[index].date}>{points[index].date}</time>
      {series.map(s => <span key={s.label}>{s.label} <strong>{forecastMoney(s.values[index])}</strong></span>)}
    </div>
    <details className="chart-data"><summary>View chart data</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={`${title} data table`}><table>
      <thead><tr><th scope="col">Date</th>{series.map(s => <th scope="col" key={s.label}>{s.label} (USD)</th>)}</tr></thead>
      <tbody>{points.map((p, i) => <tr key={p.year}><th scope="row">{p.date}</th>{series.map(s => <td key={s.label}>{forecastMoney(s.values[i])}</td>)}</tr>)}</tbody>
    </table></div></details>
  </section>;
}

export type ForecastTimelineStatus = { label: string; state: 'unknown' | 'waiting' | 'after' };

export function ForecastTimeline({ title, description, points, statuses, metric, event }: {
  title: string; description: string; points: ForecastPoint[]; statuses: ForecastTimelineStatus[];
  metric: { label: string; value: string }; event?: { label: string; date: string };
}) {
  const id = useId();
  const [selected, setSelected] = useState(points.length - 1);
  const index = Math.min(selected, points.length - 1);
  const point = points[index];

  return <section className="forecast-chart" aria-labelledby={id}>
    <h3 id={id}>{title}</h3>
    <p className="chart-note">{description}</p>
    <div className="forecast-rent-metric"><strong>{metric.value}</strong><span>{metric.label}</span></div>
    <p className="forecast-timeline-caption">Rental timing at selected dates{event && <> · {event.label} <time dateTime={event.date}>{event.date}</time></>}</p>
    <div className="forecast-timeline" role="group" aria-label="Rental forecast dates">
      {points.map((p, i) => <button type="button" key={p.year} aria-pressed={i === index} aria-controls={`${id}-point`}
        data-state={statuses[i].state} onFocus={() => setSelected(i)} onClick={() => setSelected(i)}
        onPointerMove={e => { if (e.pointerType === 'mouse') setSelected(i); }}>
        {p.year ? `Year ${p.year}` : 'Start'}<span>{statuses[i].label}</span>
      </button>)}
    </div>
    <div className="forecast-point" id={`${id}-point`} aria-live="polite">
      <time dateTime={point.date}>{point.date}</time><span>{statuses[index].label}</span>
    </div>
  </section>;
}
