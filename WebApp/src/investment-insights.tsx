import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScenarioCard } from './assistant-page';
import { chatForecast } from './use-assistant';
import { money } from './format';
import { useResource } from './ui';
import type { Session } from './types';

export function PropertyInsights({ id, title }: { id: string; title: string }) {
  const result = useResource<{ forecast?: unknown; status?: string }>(`/assistant/property-insights/${encodeURIComponent(id)}`);
  const card = chatForecast(result.data?.forecast);
  const base = card?.data.scenarios.find(scenario => scenario.id === 'base')?.points.find(point => point.year === card.horizon);
  const context = new URLSearchParams({ property: title, propertyId: id });
  return <section className="panel" aria-label="Property AI Insights">
    <h2>AI Insights</h2>
    {result.error && <p role="status">Insights are temporarily unavailable. <button onClick={result.retry}>Retry</button></p>}
    {result.data?.status === 'no_data' && <p>There are no current approved forecast rates for this property.</p>}
    {base?.positionValue != null && <p>Conditional base estimate for one share in {card?.horizon} years: <strong>{money(base.positionValue)}</strong>.</p>}
    {card && <details><summary>Approved one-share forecast</summary><ScenarioCard card={card}/></details>}
    <nav className="actions" aria-label="Property insight actions">
      <Link to={`/assistant?${context}&action=analyse`}>Analyse with AI</Link>
      <Link to={`/assistant?${context}&action=compare`}>Compare</Link>
      <Link to={`/assistant?${context}&action=forecast`}>Show forecast</Link>
    </nav>
  </section>;
}

type Portfolio = { balance: number; propertyCount: number; invested: number; concentration: number | null; demo: boolean };

export function PortfolioInsights({ session }: { session: Session }) {
  const key = `ownersclub.portfolio-insights.v1.${session.user.id}`;
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(key) === '1');
  if (dismissed) return null;
  return <PortfolioSnapshot dismiss={() => { sessionStorage.setItem(key, '1'); setDismissed(true); }}/>;
}

function PortfolioSnapshot({ dismiss }: { dismiss: () => void }) {
  const result = useResource<Portfolio>('/assistant/portfolio-insights');
  const data = result.data;
  if (!data || !Number.isFinite(data.balance) || !Number.isFinite(data.propertyCount)) return null;
  return <section className="panel" aria-label="Portfolio AI Insights">
    <div className="section-heading"><h2>AI Insights {data.demo && <span className="tag">Demo</span>}</h2>
      <button type="button" onClick={dismiss}>Dismiss insights</button></div>
    <p>Available balance <strong>{money(data.balance)}</strong> · Confirmed holdings across <strong>{data.propertyCount}</strong> {data.propertyCount === 1 ? 'property' : 'properties'}.</p>
    {data.concentration != null && <p>Your largest position accounts for <strong>{data.concentration}%</strong> of the recorded amount invested in confirmed holdings.</p>}
    <nav className="actions" aria-label="Portfolio insight actions"><Link to="/investments">Review holdings</Link><Link to="/assistant">Ask about options</Link></nav>
  </section>;
}
