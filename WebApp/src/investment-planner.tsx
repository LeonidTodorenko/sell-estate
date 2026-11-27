import { AllocationChart } from './charts';
import { useEffect, useId, useMemo, useState } from 'react';
import { api, ApiError, requestAssistantForecast, requestInvestmentForecast } from './api';
import { ForecastChart, ForecastTimeline, forecastMoney } from './forecast-chart';
import { forecastRequest, horizons, initialInputs, isForecast, type Forecast, type Horizon, type Inputs } from './forecast-data';
import './investment-planner.css';

export function InvestmentPlanner({ propertyId, totalShares, assistant = false, isDemo = false }: {
  propertyId: string; totalShares: number; assistant?: boolean; isDemo?: boolean;
}) {
  const title = useId();
  const [inputs, setInputs] = useState(() => assistant ? { ...initialInputs, base: '', optimistic: '' } : initialInputs);
  const [horizon, setHorizon] = useState<Horizon>(5);
  const [attempt, setAttempt] = useState(0);
  const request = useMemo(() => forecastRequest(inputs, totalShares), [inputs, totalShares]);
  const [result, setResult] = useState<{ key: string; data?: Forecast; answer?: string; error?: string }>();
  const body = request.body;
  const key = JSON.stringify([propertyId, inputs, totalShares, attempt]);

  useEffect(() => {
    if (!body) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = assistant ? await requestAssistantForecast(propertyId, body, controller.signal) : null;
        const data = assistant ? response?.chart : await requestInvestmentForecast(propertyId, body, controller.signal);
        const answer = response?.text;
        if (assistant && (typeof answer !== 'string' || !answer.trim() || answer.length > 500))
          throw new Error('The server returned an unsupported answer.');
        if (controller.signal.aborted) return;
        if (!isForecast(data, propertyId, body.shares)) throw new Error('The server returned an unsupported forecast.');
        setResult({ key, data, answer: typeof answer === 'string' ? answer : undefined });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof ApiError && [404, 405].includes(error.status)
          ? 'The investment forecast is unavailable for this property.'
          : error instanceof Error ? error.message : 'The forecast could not be loaded.';
        setResult({ key, error: message });
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [assistant, body, key, propertyId]);

  const current = result?.key === key ? result : undefined;
  const edit = (name: keyof Inputs, label: string, constraints: { min?: number; max?: number; step?: number | 'any'; type?: 'date' } = {}) =>
    <label>{label}<input type={constraints.type ?? 'number'} value={inputs[name]} {...constraints}
      onChange={e => {
        const value = e.currentTarget.value;
        setInputs(previous => ({ ...previous, [name]: value }));
        setAttempt(previous => previous + 1);
      }}/></label>;

  return <section className="panel investment-planner" aria-labelledby={title}>
    <header className="forecast-header">
      <h2 id={title}>{assistant ? 'Investment scenarios' : 'Investment Planner'}</h2>
      {isDemo && <span className="tag">Demo</span>}
      <p>Model the cost of buying shares, their value under different scenarios, and the timing of rental income.</p>
      <p className="forecast-risk">Prices can fall and you could lose money. Growth rates are illustrative assumptions. Returns are uncertain.</p>
    </header>
    <div className="forecast-controls">
      {edit('shares', 'Shares to model', { min: 1, max: totalShares > 0 ? totalShares : 2147483647, step: 1 })}
      <div><span className="forecast-control-label">Time horizon</span><div className="chart-ranges" role="group" aria-label="Forecast horizon">
        {horizons.map(year => <button type="button" key={year} aria-pressed={horizon === year} onClick={() => setHorizon(year)}>{year} {year === 1 ? 'year' : 'years'}</button>)}
      </div></div>
    </div>
    <details className="chart-data forecast-assumptions" open={assistant || undefined}><summary>Risks &amp; assumptions</summary>
      <p>Annual rates are illustrative. Enter them in ascending order. The stress rate must be below 0%. All three rates may be negative.</p>
      <div className="forecast-inputs">
        {edit('negative', 'Stress growth (%)', { min: -100, max: 0, step: 'any' })}
        {edit('base', 'Base growth (%)', { min: -100, max: 100, step: 'any' })}
        {edit('optimistic', 'Optimistic growth (%)', { min: -100, max: 100, step: 'any' })}
        {edit('startDate', 'Assumed rental start', { type: 'date' })}
        {edit('feePercent', 'Assumed club fee (%)', { min: 0, max: 100, step: 'any' })}
      </div>
      <p className="muted">The rental start and club fee are optional assumptions. Leave them blank if unknown.</p>
      {current?.data && <StressScenario data={current.data} horizon={horizon}/>}
    </details>
    <div aria-busy={!!body && !current}>
      {request.error && <p role="status" className="note">{request.error}</p>}
      {body && !current && <p role="status" className="note">Calculating scenarios…</p>}
      {current?.error && <div role="alert" className="note">{current.error} <button type="button" className="text-button" onClick={() => setAttempt(previous => previous + 1)}>Retry forecast</button></div>}
      {current?.answer && <p className="assistant-answer">{current.answer}</p>}
      {current?.data && <ForecastResults data={current.data} horizon={horizon}/>}
    </div>
    {!assistant && <Buyback propertyId={propertyId}/>}
  </section>;
}

function StressScenario({ data, horizon }: { data: Forecast; horizon: Horizon }) {
  const stress = data.scenarios.find(s => s.id === 'negative')!;
  return <section><h3>Stress scenario · {stress.annualGrowthPercent}% per year</h3>
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Stress scenario data table"><table><thead><tr><th scope="col">Date</th><th scope="col">Share position value (USD)</th><th scope="col">Unrealized change from starting value (USD)</th></tr></thead>
      <tbody>{stress.points.filter(p => p.year <= horizon).map(p => <tr key={p.year}>
        <th scope="row">{p.date}</th><td>{forecastMoney(p.positionValue)}</td><td>{forecastMoney(p.unrealizedChangeFromRecordedValue)}</td>
      </tr>)}</tbody></table></div>
  </section>;
}

export function ForecastResults({ data, horizon }: { data: Forecast; horizon: Horizon }) {
  const points = data.cashFlow.filter(p => p.year <= horizon);
  const base = data.scenarios.find(s => s.id === 'base')!;
  const optimistic = data.scenarios.find(s => s.id === 'optimistic')!;
  const start = base.points[0];
  const end = base.points.find(p => p.year === horizon)!;
  const valueSeries = [base, optimistic].map((scenario, i) => ({
    label: `${i === 0 ? 'Base' : 'Optimistic'} (${scenario.annualGrowthPercent}%/yr)`,
    color: i === 0 ? '#087a4e' : '#305f9f',
    dashed: i === 1,
    values: scenario.points.filter(p => p.year <= horizon).map(p => p.positionValue),
  }));
  const rentStart = data.rentAssumptions?.startDate;
  const rentalPoints = data.rentalProjection?.points.filter(point => point.year <= horizon);

  const rentAtHorizon = rentalPoints?.at(-1)?.afterClubFee;
  const growthAtHorizon = end.unrealizedChangeFromRecordedValue;

  return <>
    <dl className="forecast-totals">
      <div><dt>Upfront purchase cost</dt><dd>{forecastMoney(data.primaryPurchaseCost)}</dd>
        <small>{data.shares} {data.shares === 1 ? 'share' : 'shares'} · {forecastMoney(data.offerPricePerShare)} per share. Full cost is debited when you buy.</small></div>
      <div><dt>Saved value of modeled shares</dt><dd>{forecastMoney(start.positionValue)}</dd>
        <small>From the saved whole-property valuation of {forecastMoney(data.recordedPropertyPrice)}.</small></div>
      <div><dt>Base unrealized change</dt><dd>{forecastMoney(end.unrealizedChangeFromRecordedValue)}</dd>
        <small>Year {horizon} compared with the saved value of these shares.</small></div>
    </dl>
    <ForecastChart key={`value-${horizon}`} title="Value of your share position" points={points} series={valueSeries}
      description="Illustrative scenarios anchored to the saved valuation. Dots show discrete estimates on the dates you can select below."/>
    {growthAtHorizon != null && rentAtHorizon != null && <AllocationChart
      key={`composition-${horizon}`} title={`Base scenario · Year ${horizon} components`}
      description="Conditional unrealized change and cumulative modeled rent after the assumed club fee, in USD. The chart divides the positive components by their sum."
      items={[
        { label: 'Unrealized change', value: growthAtHorizon },
        { label: 'Conditional rental income', value: rentAtHorizon },
      ]}/>}
    <ForecastTimeline key={`rent-${horizon}`} title="Expected rent" points={points}
      description="Rental timing is hypothetical. Payouts are uncertain."
      metric={{ label: 'Configured monthly amount for the whole property', value: forecastMoney(data.configuredMonthlyPropertyRent) }}
      event={rentStart ? { label: 'Assumed rental start', date: rentStart } : undefined}
      statuses={points.map(point => !rentStart ? { label: 'Start date unknown', state: 'unknown' }
        : point.date <= rentStart ? { label: 'No accrual by this date', state: 'waiting' }
        : { label: 'After the assumed start', state: 'after' })}/>
    {rentalPoints && <ForecastChart key={`rental-projection-${horizon}`} title="Conditional rental income" points={rentalPoints}
      description="Cumulative USD for the modeled shares from complete rental months. The configured amount already accounts for property expenses. A club fee is included only when specified."
      series={[
        { label: 'Before club fee', color: '#087a4e', values: rentalPoints.map(point => point.beforeClubFee) },
        { label: 'After assumed club fee', color: '#305f9f', dashed: true, values: rentalPoints.map(point => point.afterClubFee) },
      ]}/>}
  </>;
}

function Buyback({ propertyId }: { propertyId: string }) {
  const [price, setPrice] = useState<number | null>();
  useEffect(() => {
    const controller = new AbortController();
    api<{ buybackPrice: number | null }>(`/properties/${encodeURIComponent(propertyId)}/buyback-price`, controller.signal)
      .then(result => {
        if (!controller.signal.aborted) {
          const value = result?.buybackPrice;
          setPrice(typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);
        }
      })
      .catch(() => { if (!controller.signal.aborted) setPrice(null); });
    return () => controller.abort();
  }, [propertyId]);

  return <section className="forecast-buyback">
    <h3>Platform buyback</h3>
    {typeof price === 'number' && <p><strong>{forecastMoney(price)}</strong> per share · saved buyback price</p>}
    {price === undefined && <p role="status">Checking the saved buyback price…</p>}
    {price === null && <p>Saved buyback price unavailable.</p>}
    <p>Availability is conditional. Platform buyback is unavailable in this WebApp release.</p>
  </section>;
}
