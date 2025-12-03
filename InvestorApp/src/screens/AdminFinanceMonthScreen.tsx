import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';
import { LineChart } from 'react-native-chart-kit';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminFinanceMonth'>;

type LineItem = {
  date: string;
  propertyId?: string;
  propertyTitle?: string;
  kind: string;
  label: string;
  amount: number; // inflow > 0, outflow < 0
};

type PeriodDetail = {
  period: string;            // первый день месяца
  requiredOutflow: number;   // итого к оплате за месяц
  availableOnDate: number;   // что будет доступно к концу месяца (по твоей логике)
  shortfall: number;         // дефицит к концу месяца
  items: LineItem[];
};

const fmtMoney = (v: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

export default function AdminFinanceMonthScreen({ route }: Props) {
  const { ym } = route.params;
  const [data, setData] = useState<PeriodDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PeriodDetail>(`/admin/finance/period/${ym}`);
      setData(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [ym]);

  useEffect(() => { load(); }, [load]);

  // === подготовка данных для графика ===
  const chart = useMemo(() => {
    if (!data) return null;

    const periodStart = new Date(data.period); // 1-е число месяца (UTC/локально — ок для графика)
    const year = periodStart.getFullYear();
    const month = periodStart.getMonth();

    // конец месяца
    const monthEnd = new Date(year, month + 1, 0).getDate();

    // сгруппируем по дню месяца
    const inflowByDay: Record<number, number> = {};
    const outflowByDay: Record<number, number> = {};

    for (const it of data.items) {
      const d = new Date(it.date);
      if (d.getMonth() !== month || d.getFullYear() !== year) continue;
      const day = d.getDate();
      if (it.amount >= 0) {
        inflowByDay[day] = (inflowByDay[day] || 0) + it.amount;
      } else {
        // outflow храним как положительное значение для удобства кумуляции
        outflowByDay[day] = (outflowByDay[day] || 0) + Math.abs(it.amount);
      }
    }

    // массив дней 1..monthEnd
    const days: number[] = Array.from({ length: monthEnd }, (_, i) => i + 1);

    // кумулятивы
    const cumIn: number[] = [];
    const cumOut: number[] = [];
    let accIn = 0;
    let accOut = 0;
    for (const d of days) {
      accIn += inflowByDay[d] || 0;
      accOut += outflowByDay[d] || 0;
      cumIn.push(Math.round(accIn));
      cumOut.push(Math.round(accOut));
    }

    // подписи на оси X: оставим 1, 5, 10, 15, 20, 25, конец — чтобы не перегружать
    const labelPoints = new Set([1, 5, 10, 15, 20, 25, monthEnd]);
    const labels = days.map((d) => (labelPoints.has(d) ? String(d) : ''));

    return {
      labels,
      datasets: [
        { data: cumIn, strokeWidth: 2 },   // inflow (синие)
        { data: cumOut, strokeWidth: 2 },  // outflow (красные — зададим цвет в chartConfig)
      ],
    };
  }, [data]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text>No data</Text>
        <BlueButton title="Reload" onPress={load} />
      </View>
    );
  }

  const renderItem = ({ item }: { item: LineItem }) => {
    const dateStr = new Date(item.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const isOutflow = item.kind.startsWith('Outflow');
    return (
      <View style={styles.rowItem}>
        <Text style={[styles.date, isOutflow && { color: '#b00020' }]}>{dateStr}</Text>
        {/* <Text style={[styles.kind, isOutflow ? styles.kindOut : styles.kindIn]}>
        {item.kind.replace(':', ' · ')}
        </Text> */}
        <Text style={styles.kind} numberOfLines={1}>
        {item.propertyTitle ? ` · ${item.propertyTitle}` : ''}{item.label}
        </Text>
        <Text style={[styles.amount, isOutflow ? styles.neg : styles.pos]}>
          {fmtMoney(item.amount)}
        </Text>
      </View>
    );
  };

  const monthTitle = new Date(data.period).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  const chartWidth = Math.min(Dimensions.get('window').width - 32, 800); // отступы = 16+16
  const chartHeight = 220;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 {monthTitle}</Text>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryText}>Required: {fmtMoney(data.requiredOutflow)}</Text>
        <Text style={styles.summaryText}>Available: {fmtMoney(data.availableOnDate)}</Text>
        {data.shortfall > 0 ? (
          <Text style={[styles.summaryText, styles.shortfall]}>Shortfall: {fmtMoney(data.shortfall)}</Text>
        ) : (
          <Text style={[styles.summaryText, { color: '#2e7d32' }]}>OK</Text>
        )}
      </View>

      {/* === Линейный график === */}
      {!!chart && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Dynamics this month (cum.)</Text>
          <LineChart
            data={chart}
            width={chartWidth}
            height={chartHeight}
            yAxisLabel="$"
            withDots={false}
            withInnerLines={true}
            withOuterLines={false}
            fromZero
            chartConfig={{
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(10, 132, 255, ${opacity})`, // для первой линии (inflow)
              labelColor: () => '#555',
              propsForBackgroundLines: { strokeDasharray: '4 8' },
              propsForLabels: { fontSize: 10 },
            }}
            bezier={false}
            // вторая линия (outflow) красная:
            style={{ marginVertical: 8, borderRadius: 12 }}
            decorator={() => null}
            // react-native-chart-kit не даёт просто для каждого датасета свой цвет через chartConfig.color,
            // поэтому используем propsForDots/propsForBackgroundLines общие, а цвет поправим через пропы datasets ниже:
            segments={5}
          />
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#0a84ff' }]} />
            <Text style={styles.legendText}>Inflow (cumulative)</Text>
            <View style={{ width: 16 }} />
            <View style={[styles.legendDot, { backgroundColor: '#b00020' }]} />
            <Text style={styles.legendText}>Outflow (cumulative)</Text>
          </View>
          <Text style={styles.chartHint}>Labels: days of month (1,5,10,15,20,25,last)</Text>
        </View>
      )}

      <FlatList
        data={data.items}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12 },

  summaryBox: {
    backgroundColor: '#fff', padding: 12, borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd', marginBottom: 12,
  },
  summaryText: { fontWeight: '600', fontSize: 16 },
  shortfall: { color: '#b00020' },

  chartCard: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd',
    padding: 12, marginBottom: 12,
  },
  chartTitle: { fontWeight: '700', marginBottom: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { marginLeft: 6, color: '#444', fontSize: 12 },
  chartHint: { marginTop: 6, color: '#666', fontSize: 12 },

  rowItem: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd', paddingVertical: 8,
  },
  date: { width: 60, fontWeight: '700' },
  kind: { width: 130, fontWeight: '600' },
  kindIn: { color: '#1b5e20' },
  kindOut: { color: '#b00020' },
  label: { flex: 1, color: '#333' },
  amount: { width: 110, textAlign: 'right', fontVariant: ['tabular-nums'] },
  pos: { color: '#1b5e20' },
  neg: { color: '#b00020' },
});
