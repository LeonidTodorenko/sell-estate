import AssetAllocation from './AssetAllocation';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';

type Point = { year: number; date?: string; positionValue: number | null; unrealizedChangeFromRecordedValue?: number | null; changeFromRecordedValuePercent?: number | null };
type Series = { id: string; annualGrowthPercent: number; points: Point[] };
export type Scenario = {
  property: string; horizon: number; demo?: boolean; source?: string; ratesAsOf?: string;
  data: { schemaVersion: 1; currency: 'USD'; shares: number; asOf: string; primaryPurchaseCost: number | null; scenarios: Series[];
    rentalProjection?: { points: { year: number; afterClubFee: number | null }[] } };
};

export function readScenario(value: unknown): Scenario | undefined {
  if (!value || typeof value !== 'object') return;
  const card = value as Scenario;
  const amount = (n: unknown) => n === null || (typeof n === 'number' && Number.isFinite(n));
  const data = card.data;
  if (typeof card.property !== 'string' || !Number.isInteger(card.horizon) || !data ||
      data.schemaVersion !== 1 || data.currency !== 'USD' || typeof data.asOf !== 'string' ||
      !Number.isSafeInteger(data.shares) || data.shares < 1 || !amount(data.primaryPurchaseCost) ||
      !Array.isArray(data.scenarios) || data.scenarios.length !== 3 ||
      !['base', 'optimistic', 'negative'].every(id => data.scenarios.some(series =>
        series?.id === id && Number.isFinite(series.annualGrowthPercent) && Array.isArray(series.points) &&
        series.points.length >= 2 && series.points.length <= 11 &&
        series.points.every((point, index) => point && Number.isInteger(point.year) && point.year <= 10 &&
          (index ? point.year > series.points[index - 1].year : point.year === 0) &&
          amount(point.positionValue) && amount(point.unrealizedChangeFromRecordedValue ?? null) &&
          amount(point.changeFromRecordedValuePercent ?? null)) && series.points.some(point => point.year === card.horizon)))) return;
  return card;
}

const colors: Record<string, string> = { base: '#087a4e', optimistic: '#305f9f', negative: '#a34729' };
const names: Record<string, string> = { base: 'Base', optimistic: 'Optimistic', negative: 'Stress' };
const compact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const money = (n?: number | null) => n == null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export function AssistantScenarioCard({ card }: { card: Scenario }) {
  const [year, setYear] = useState(card.horizon);
  const [risk, showRisk] = useState(false);
  const { data } = card;
  const base = data.scenarios.find(s => s.id === 'base');
  const point = base?.points.find(p => p.year === year);
  const rentTimeline = data.rentalProjection?.points;
  const rent = Array.isArray(rentTimeline) ? rentTimeline.find(p => p?.year === year)?.afterClubFee : undefined;
  const growth = point?.unrealizedChangeFromRecordedValue;
  return <View style={styles.card}>
    <Text style={styles.heading}>{card.property}{card.demo === true ? ' · Demo' : ''}</Text>
    <Text style={styles.label}>Base estimate · Year {year} · {data.shares} {data.shares === 1 ? 'share' : 'shares'}</Text>
    <Text accessibilityLiveRegion="polite" style={styles.estimate}>{money(point?.positionValue)}</Text>
    {point?.unrealizedChangeFromRecordedValue != null && <Text style={styles.label}>
      {money(point.unrealizedChangeFromRecordedValue)}{point.changeFromRecordedValuePercent != null ? ` (${point.changeFromRecordedValuePercent}%)` : ''} vs. saved valuation
    </Text>}
    <Text style={styles.label}>Upfront cost {money(data.primaryPurchaseCost)}</Text>
    <Text style={styles.label}>Calculated {data.asOf} · {typeof card.source === 'string' ? card.source : 'Conditional assumptions'}{typeof card.ratesAsOf === 'string' ? ` · ${card.ratesAsOf}` : ''}</Text>
    <View style={styles.controls}>{base?.points.filter(p => p.year > 0).map(p =>
      <Pressable key={p.year} accessibilityRole="button" accessibilityLabel={`Year ${p.year}`}
        accessibilityState={{ selected: p.year === year }} onPress={() => setYear(p.year)}
        style={[styles.button, p.year === year && styles.selected]}>
        <Text style={styles.label}>{p.year}y</Text>
      </Pressable>)}</View>
    <Chart key={year} year={year} series={data.scenarios.filter(s => card.demo !== true || s.id !== 'negative')}/>
    {typeof rent === 'number' && Number.isFinite(rent) && typeof growth === 'number' && <AssetAllocation
      key={year} title="Base scenario components"
      description="Conditional unrealized change and modeled cumulative rent after the assumed club fee, in USD."
      items={[{ label: 'Unrealized change', value: growth }, { label: 'Conditional rental income', value: rent }]}/>}
    {card.demo === true && <Pressable accessibilityRole="button" accessibilityState={{ expanded: risk }} onPress={() => showRisk(!risk)} style={styles.button}>
      <Text style={styles.label}>Risk · stress scenario</Text>
    </Pressable>}
    {card.demo === true && risk && <Chart key={year} year={year} series={data.scenarios.filter(s => s.id === 'negative')}/>}
  </View>;
}

function Chart({ year, series }: { year: number; series: Series[] }) {
  const [selectedYear, setSelectedYear] = useState(year);
  const selection = Math.min(selectedYear, year);
  const values = series.flatMap(s => s.points.filter(p => p.year <= year && p.positionValue !== null).map(p => p.positionValue!));
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const x = (n: number) => 63 + n / year * 204;
  const y = (n: number) => 110 - (n - min) / (max - min || 1) * 94;
  return <View>
    {!!values.length && <Svg width="100%" height={142} viewBox="0 0 280 142" accessible={false}>
      {[...new Set([min, (min + max) / 2, max, 0])].map(tick => <React.Fragment key={tick}>
        <Line x1={63} x2={267} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#8ca598' : '#d4e2d9'}/>
        <SvgText x={58} y={y(tick) + 4} textAnchor="end" fill="#304c3e" fontSize={10}>{compact.format(tick)}</SvgText>
      </React.Fragment>)}
      <SvgText x={63} y={130} fill="#304c3e" fontSize={11}>Start</SvgText>
      <SvgText x={267} y={130} fill="#304c3e" fontSize={11} textAnchor="end">Year {year}</SvgText>
      <Line x1={x(selection)} x2={x(selection)} y1={16} y2={110} stroke="#8ca598" strokeDasharray={[3, 4]}/>
      {series.map(s => {
        const points = s.points.filter(p => p.year <= year);
        return <React.Fragment key={s.id}>
          {points.map((p, i) => {
            const previous = points[i - 1];
            return p.positionValue === null ? null : <React.Fragment key={p.year}>
              {previous?.positionValue != null && <Polyline points={`${x(previous.year)},${y(previous.positionValue)} ${x(p.year)},${y(p.positionValue)}`} stroke={colors[s.id]} strokeWidth={2.5}/>}
              <Circle cx={x(p.year)} cy={y(p.positionValue)} r={p.year === selection ? 5 : 3} fill={colors[s.id]}/>
              <Circle cx={x(p.year)} cy={y(p.positionValue)} r={13} fill="transparent" onPress={() => setSelectedYear(p.year)}/>
            </React.Fragment>;
          })}
        </React.Fragment>;
      })}
    </Svg>}
    {!values.length && <Text style={styles.label}>No values available</Text>}
    {!!values.length && <View style={styles.controls}>{series[0].points.filter(p => p.year <= year).map(p =>
      <Pressable key={p.year} accessibilityRole="button" accessibilityState={{ selected: p.year === selection }}
        style={[styles.button, p.year === selection && styles.selected]} onPress={() => setSelectedYear(p.year)}>
        <Text style={styles.label}>{p.year ? `Year ${p.year}` : 'Start'}</Text>
      </Pressable>)}</View>}
    {!!values.length && <Text accessibilityLiveRegion="polite" style={styles.label}>
      {series[0].points.find(p => p.year === selection)?.date ?? (selection ? `Year ${selection}` : 'Start')}
    </Text>}
    {series.map(s => <Text key={s.id} style={[styles.label, { color: colors[s.id] }]}>
      {names[s.id]} ({s.annualGrowthPercent}%/yr) · {money(s.points.find(p => p.year === selection)?.positionValue)}
    </Text>)}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 12, backgroundColor: '#fff', borderColor: '#d4e2d9', borderWidth: 1, borderRadius: 12, gap: 6 },
  heading: { color: '#20392f', fontSize: 16, fontWeight: '700' },
  label: { color: '#304c3e', fontSize: 13 },
  estimate: { color: '#183c2d', fontSize: 25, fontWeight: '800' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  button: { minHeight: 44, minWidth: 44, padding: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#f2f7f3' },
  selected: { backgroundColor: '#d8ede2', borderColor: '#438568', borderWidth: 1 },
});
