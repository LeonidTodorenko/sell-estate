import { AllocationChart } from './charts';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ForecastChart, forecastMoney } from './forecast-chart';
import type { ChatForecast } from './use-assistant';
import './investment-planner.css';
import { API_BASE_URL, signOut } from './api';
import type { Session } from './types';
import { faqQuestions, useAssistant } from './use-assistant';
import './assistant.css';

const destinations = {
  balance: '/finance', investments: '/investments', applications: '/applications',
  payments: '/transactions', properties: '/properties', market: '/marketplace', 'rental-income': '/rental-income',
} as const;

export function AssistantPage({ session }: { session: Session }) {
  return <Conversation key={session.accessToken} token={session.accessToken}/>;
}

function Conversation({ token }: { token: string }) {
  const { messages, send, pending, error, allowExternal, setAllowExternal, copy, sections } = useAssistant(API_BASE_URL, token);
  const [search] = useSearchParams();
  const [draft, setDraft] = useState(() => {
    const title = search.get('property');
    if (!title) return '';
    if (search.get('action') === 'compare') return `Compare ${title} and `.slice(0, 400);
    return search.get('action') === 'analyse' ? 'Analyse this property with a forecast' : `Show a forecast for ${title}`.slice(0, 400);
  });
  const latest = useRef<HTMLDivElement>(null);
  const disabled = pending || error === 'expired';
  useEffect(() => {
    if (messages.length) latest.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, pending]);

  return <section className="assistant-page" aria-labelledby="assistant-title">
    <header className="assistant-heading">
      <h1 id="assistant-title">{copy.title}</h1>
    </header>
    <details id="assistant-faq" open>
      <summary>{copy.faq}</summary>
      <div className="assistant-actions">
        {faqQuestions.map(question => <button key={question} disabled={disabled} onClick={() => void send(question)}>{question}</button>)}
      </div>
    </details>
    <details open>
      <summary>{copy.account}</summary>
      <div className="assistant-actions">
        {sections.map(section => <button key={section} disabled={disabled} onClick={() => void send(copy[section], section)}>{copy[section]}</button>)}
      </div>
    </details>
    <div role="log" aria-label={copy.title} className="assistant-history">
      {messages.map((message, index) => <div className="assistant-turn" key={index}>
        <p className="assistant-question">{message.question}</p>
        {message.answer && <div className={(message.forecast || message.allocation) ? 'assistant-answer assistant-answer-with-chart' : 'assistant-answer'}>
          <p>{message.answer}</p>
          {message.allocation && <AllocationChart title={message.allocation.demo ? 'Asset structure · Demo' : 'Asset structure'}
            description="Estimated asset values in USD. The wallet includes credited rental payouts." items={message.allocation.items}/>}
          {message.forecast && <ScenarioCard card={message.forecast}/>}
          {!!message.sourceLinks?.length && <ul>
            {message.sourceLinks.map(source => <li key={source.title}>
              {source.url && (/^https:\/\/wamsoc\.com\/(about|register|support)$/.test(source.url) ||
                source.url === 'https://dubailand.gov.ae/en/open-data/real-estate-data/')
                ? <a href={source.url}>{source.title}</a>
                : source.title}
            </li>)}
          </ul>}
          {message.destination && <Link to={destinations[message.destination]}>{copy[message.destination]}</Link>}
          {message.unknown && <a href="#assistant-faq">{copy.faq}</a>}
        </div>}
      </div>)}
      {pending && <p role="status">{copy.pending}</p>}
      {error && <p role="alert">{copy[error]} {error === 'expired' && <button type="button" onClick={() => void signOut()}>{copy.signIn}</button>}</p>}
      <div ref={latest}/>
    </div>
    <label><input type="checkbox" checked={allowExternal} disabled={pending}
      onChange={event => setAllowExternal(event.target.checked)}/>
      Allow Google Gemini to process general chat messages for this session. Google may use them to improve its products. Account answers and purchase estimates stay on OwnersClub. Do not enter private information in general chat.
    </label>
    <form className="assistant-composer" onSubmit={event => {
      event.preventDefault();
      if (disabled || !draft.trim()) return;
      void send(draft, undefined, messages.length === 0 ? search.get('propertyId') ?? undefined : undefined);
      setDraft('');
    }}>
      <input aria-label={copy.prompt} placeholder={copy.prompt} maxLength={400} value={draft} onChange={event => setDraft(event.target.value)}/>
      <button className="button" disabled={disabled || !draft.trim()}>{copy.send}</button>
    </form>
  </section>;
}

export function ScenarioCard({ card }: { card: ChatForecast }) {
  const [horizon, setHorizon] = useState(card.horizon);
  const { data } = card;
  const points = data.cashFlow.filter(point => point.year <= horizon);
  const rental = data.rentalProjection?.points.filter(point => point.year <= horizon);
  const estimate = data.scenarios.find(scenario => scenario.id === 'base')?.points.find(point => point.year === horizon);
  const series = data.scenarios.map(scenario => ({
    id: scenario.id,
    label: `${scenario.id === 'negative' ? 'Stress' : scenario.id === 'base' ? 'Base' : 'Optimistic'} (${scenario.annualGrowthPercent}%/yr)`,
    color: scenario.id === 'negative' ? '#a34729' : scenario.id === 'base' ? '#087a4e' : '#305f9f',
    dashed: scenario.id !== 'base',
    values: scenario.points.filter(point => point.year <= horizon).map(point => point.positionValue),
  }));
  const signed = (value: number) => value > 0 ? '+' : '';
  const change = estimate?.unrealizedChangeFromRecordedValue;
  const percent = estimate?.changeFromRecordedValuePercent;
  return <section className="assistant-scenario" aria-label={card.property}>
    <h3>{card.property} {card.demo === true && <span className="tag">Demo</span>}</h3>
    <div className="assistant-estimate"><span>Base estimate · Year {horizon}</span>
      <strong>{forecastMoney(estimate?.positionValue ?? null)}</strong>
      {change != null && <span>{signed(change)}{forecastMoney(change)}{percent != null && ` (${signed(percent)}${percent}%)`} vs. saved valuation</span>}
    </div>
    <p className="chart-note">Calculated {data.asOf} · {card.source ? `${card.source} (${card.rateScope ?? 'approved'}, ${card.ratesAsOf ?? 'date unavailable'})` : 'Conditional assumptions'}</p>
    <p>{data.shares} {data.shares === 1 ? 'share' : 'shares'} · Upfront cost {forecastMoney(data.primaryPurchaseCost)}</p>
    <div className="chart-ranges" role="group" aria-label="Scenario horizon">
      {data.cashFlow.filter(point => point.year > 0).map(({ year }) =>
        <button type="button" key={year} aria-pressed={year === horizon} onClick={() => setHorizon(year)}>
          {year} {year === 1 ? 'year' : 'years'}
        </button>)}
    </div>
    <ForecastChart key={horizon} title="Scenario value" description="Conditional annual rates and saved valuation."
      points={points} series={series.filter(item => card.demo !== true || item.id !== 'negative')}/>
    {card.demo === true && <details><summary>Risk · stress scenario</summary>
      <ForecastChart key={horizon} title="Stress scenario" description="Conditional downside. Value may fall."
        points={points} series={series.filter(item => item.id === 'negative')}/>
    </details>}
    {card.rental && rental && <details open><summary>Conditional rent</summary>
      <ForecastChart key={horizon} title="Rental income" description="Complete months using the assumed start. Payouts are uncertain."
        points={rental} series={[
          { label: 'Before club fee', color: '#087a4e', values: rental.map(point => point.beforeClubFee) },
          { label: 'After assumed fee', color: '#305f9f', dashed: true, values: rental.map(point => point.afterClubFee) },
        ]}/>
    </details>}
  </section>;
}
