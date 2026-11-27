export const horizons = [1, 3, 5, 10] as const;
export type Horizon = typeof horizons[number];

export const missingLabels: Record<string, string> = {
  recordedPropertyPrice: 'Saved property valuation',
  offerPricePerShare: 'Offer price per share',
  totalShares: 'Total shares',
  configuredMonthlyPropertyRent: 'Configured monthly property rent',
  rentStartDate: 'Rental start date',
  rentFeePercent: 'Rental fee',
  monthlyPropertyExpenses: 'Monthly operating expenses',
  completePaymentStages: 'Complete payment schedule',
};

type Rent = {
  startDate: string | null;
  feePercent: number | null;
  monthlyPropertyExpenses: number | null;
};
export type Forecast = {
  schemaVersion: 1;
  propertyId: string;
  currency: 'USD';
  asOf: string;
  shares: number;
  recordedPropertyPrice: number | null;
  offerPricePerShare: number | null;
  primaryPurchaseCost: number | null;
  rentAssumptions: Rent | null;
  configuredMonthlyPropertyRent: number | null;
  missingInputs: string[];
  scenarios: { id: string; annualGrowthPercent: number; points: ValuePoint[] }[];
  cashFlow: CashPoint[];
  rentalProjection?: {
    kind: 'conditional';
    meetsPayoutStatusAndPlanRequirements: boolean;
    missingInputs: string[];
    points: (Point & { completeMonths: number | null; beforeClubFee: number | null;
      assumedClubFee: number | null; afterClubFee: number | null })[];
  };
  paymentStages: { id: string; eventDate: string | null; dueDate: string | null; proRataAmount: number | null }[];
};
type Point = { year: number; date: string };
type ValuePoint = Point & { positionValue: number | null; unrealizedChangeFromRecordedValue: number | null; changeFromRecordedValuePercent?: number | null };
type CashPoint = Point & {
  grossRent: number | null;
  rentFees: number | null;
  operatingExpenses: number | null;
  netRent: number | null;
  scheduledStageOutflow: number | null;
  netCashAfterScheduledStages: number | null;
};

export const initialInputs = {
  shares: '1', negative: '-10', base: '0', optimistic: '0',
  startDate: '', feePercent: '', monthlyPropertyExpenses: '',
};
export type Inputs = typeof initialInputs;

export function forecastRequest(inputs: Inputs, totalShares: number) {
  const read = (value: string) => value.trim() === '' ? NaN : Number(value);
  const shares = read(inputs.shares);
  const negative = read(inputs.negative);
  const base = read(inputs.base);
  const optimistic = read(inputs.optimistic);
  const feePercent = inputs.feePercent === '' ? null : read(inputs.feePercent);
  const monthlyPropertyExpenses = inputs.monthlyPropertyExpenses === '' ? null : read(inputs.monthlyPropertyExpenses);
  if (!Number.isInteger(shares) || shares < 1 || shares > 2147483647 || (totalShares > 0 && shares > totalShares))
    return { error: 'Enter a whole number of shares within the property total.' };
  if (![negative, base, optimistic].every(value => value >= -100 && value <= 100) ||
      negative >= 0 || negative > base || base > optimistic)
    return { error: 'Use rates from −100% to 100%, in order from stress to base to optimistic. The stress rate must be below zero.' };
  if (feePercent !== null && !(feePercent >= 0 && feePercent <= 100))
    return { error: 'Enter a rental fee from 0% to 100%, or leave it blank.' };
  if (monthlyPropertyExpenses !== null && !(monthlyPropertyExpenses >= 0 && monthlyPropertyExpenses <= 1e15))
    return { error: 'Enter monthly expenses from $0 to $1 quadrillion, or leave them blank.' };
  if (inputs.startDate && !validDate(inputs.startDate))
    return { error: 'Enter a valid rental start date.' };
  return { body: { shares, growth: { negative, base, optimistic }, horizons: [...horizons],
    rent: { startDate: inputs.startDate || null, feePercent, monthlyPropertyExpenses } } };
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

const amount = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value));
export function isForecast(value: unknown, propertyId: string, shares: number, expectedHorizons: readonly number[] = horizons): value is Forecast {
  if (!value || typeof value !== 'object') return false;
  const f = value as Forecast;
  const pointsMatch = (rows: Point[]) => Array.isArray(rows) && rows.length === expectedHorizons.length + 1 &&
    rows.every((p, i) => p && p.year === (i === 0 ? 0 : expectedHorizons[i - 1]) && validDate(p.date) &&
      (i === 0 ? p.date === f.asOf : p.date > rows[i - 1].date));
  return f.schemaVersion === 1 && f.currency === 'USD' && typeof f.propertyId === 'string' &&
    f.propertyId.toLowerCase() === propertyId.toLowerCase() && f.shares === shares && validDate(f.asOf) &&
    [f.recordedPropertyPrice, f.offerPricePerShare, f.primaryPurchaseCost, f.configuredMonthlyPropertyRent].every(amount) &&
    (f.rentAssumptions === null || (!!f.rentAssumptions &&
      (f.rentAssumptions.startDate === null || validDate(f.rentAssumptions.startDate)) &&
      amount(f.rentAssumptions.feePercent) && amount(f.rentAssumptions.monthlyPropertyExpenses))) &&
    Array.isArray(f.missingInputs) && f.missingInputs.every(key => typeof key === 'string') &&
    Array.isArray(f.scenarios) && f.scenarios.length === 3 && ['negative', 'base', 'optimistic'].every(id =>
      f.scenarios.some(s => s?.id === id && Number.isFinite(s.annualGrowthPercent) && pointsMatch(s.points) &&
        s.points.every(p => amount(p.positionValue) && amount(p.unrealizedChangeFromRecordedValue) && amount(p.changeFromRecordedValuePercent ?? null)))) &&
    (f.rentalProjection === undefined || (!!f.rentalProjection && f.rentalProjection.kind === 'conditional' &&
      typeof f.rentalProjection.meetsPayoutStatusAndPlanRequirements === 'boolean' &&
      Array.isArray(f.rentalProjection.missingInputs) && f.rentalProjection.missingInputs.every(key => typeof key === 'string') &&
      pointsMatch(f.rentalProjection.points) && f.rentalProjection.points.every(p =>
        (p.completeMonths === null || (Number.isInteger(p.completeMonths) && p.completeMonths >= 0 && p.completeMonths <= 120)) &&
        [p.beforeClubFee, p.assumedClubFee, p.afterClubFee].every(amount)))) &&
    pointsMatch(f.cashFlow) && f.cashFlow.every(p =>
      [p.grossRent, p.rentFees, p.operatingExpenses, p.netRent, p.scheduledStageOutflow, p.netCashAfterScheduledStages].every(amount)) &&
    Array.isArray(f.paymentStages) && f.paymentStages.every(s => s && typeof s.id === 'string' &&
      (s.dueDate === null || validDate(s.dueDate)) && (s.eventDate === null || validDate(s.eventDate)) && amount(s.proRataAmount));
}

export function plotPath(values: (number | null)[], x: (i: number) => number, y: (n: number) => number) {
  return values.flatMap((value, i) => value === null ? [] :
    [`${i === 0 || values[i - 1] === null ? 'M' : 'L'}${x(i)},${y(value)}`]).join(' ');
}
