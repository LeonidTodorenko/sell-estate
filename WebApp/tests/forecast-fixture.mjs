export const propertyId = '6ca2c91f-10bf-46d5-bd91-32e88c7bebd3';

export function forecastFixture({ shares, growth, rent, horizons }) {
  const asOf = '2026-11-27';
  const hasRent = rent.startDate !== null && rent.feePercent !== null && rent.monthlyPropertyExpenses !== null;
  const points = [0, ...horizons].map(year => ({ year, date: `${2026 + year}-11-27` }));
  const startingValue = 100000 * shares / 100;
  const rentalPoints = points.map(point => {
    const start = rent.startDate && (rent.startDate > asOf ? rent.startDate : asOf);
    let completeMonths = null;
    if (start) {
      const [year, month, day] = start.split('-').map(Number);
      const [endYear, endMonth, endDay] = point.date.split('-').map(Number);
      completeMonths = Math.max(0, (endYear - year) * 12 + endMonth - month - Number(endDay < day));
    }
    const beforeClubFee = completeMonths === null ? null : completeMonths * shares * 10;
    const assumedClubFee = completeMonths === 0 ? 0 :
      beforeClubFee === null || rent.feePercent === null ? null : beforeClubFee * rent.feePercent / 100;
    return { ...point, completeMonths, beforeClubFee, assumedClubFee,
      afterClubFee: assumedClubFee === null ? null : beforeClubFee - assumedClubFee };
  });
  return {
    schemaVersion: 1, propertyId, currency: 'USD', asOf, shares, totalShares: 100,
    recordedPropertyPrice: 100000, offerPricePerShare: 1000, primaryPurchaseCost: shares * 1000,
    configuredMonthlyPropertyRent: 1000, rentAssumptions: rent,
    rentalProjection: { kind: 'conditional', meetsPayoutStatusAndPlanRequirements: false,
      missingInputs: [...(rent.startDate ? [] : ['rentStartDate']), ...(rent.feePercent === null ? ['rentFeePercent'] : [])],
      points: rentalPoints },
    missingInputs: hasRent ? [] : ['rentStartDate', 'rentFeePercent', 'monthlyPropertyExpenses'],
    scenarios: Object.entries(growth).map(([id, annualGrowthPercent]) => ({
      id, annualGrowthPercent, points: points.map(point => {
        const positionValue = Number((startingValue * (1 + annualGrowthPercent / 100) ** point.year).toFixed(2));
        return { ...point, positionValue, unrealizedChangeFromRecordedValue: positionValue - startingValue };
      }),
    })),
    cashFlow: points.map(point => {
      const months = point.year === 0 ? 0 : point.year * 12 - 6;
      const grossRent = rent.startDate !== null ? (point.date > rent.startDate ? months * shares : 0) : null;
      const rentFees = hasRent ? grossRent * rent.feePercent / 100 : null;
      const operatingExpenses = hasRent ? months * rent.monthlyPropertyExpenses * shares / 100 : null;
      const scheduledStageOutflow = point.year ? shares * 4 : 0;
      const netRent = hasRent ? grossRent - rentFees - operatingExpenses : null;
      return { ...point, grossRent, rentFees, operatingExpenses, netRent, scheduledStageOutflow,
        netCashAfterScheduledStages: netRent === null ? null : netRent - scheduledStageOutflow };
    }),
    paymentStages: [{ id: 'stage-1', eventDate: '2027-02-20', dueDate: '2027-03-20', proRataAmount: shares * 4 }],
  };
}
