import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
  Pressable,
  Dimensions,
} from 'react-native';
import api from '../api';
import theme from '../constants/theme';
import { LineChart } from 'react-native-chart-kit';

import growthIcon from '../assets/images/Vector.png';
import rentalIcon from '../assets/images/rental.png';

type LogEntry = {
  title: string;
  timestamp: string;
  amount: number;
};

type GroupedLogs = {
  monthLabel: string;
  items: LogEntry[];
};

type ChartPoint = {
  date: string;
  total: number;
};

function money(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString() +
    ' • ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

function getMonthLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatChartLabel(dateStr: string) {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

function filterHistoryByRange(
  points: ChartPoint[],
  range: '3m' | '6m' | '1y' | 'all'
) {
  if (!points.length || range === 'all') return points;

  const now = new Date();
  const from = new Date(now);

  if (range === '3m') from.setMonth(now.getMonth() - 3);
  if (range === '6m') from.setMonth(now.getMonth() - 6);
  if (range === '1y') from.setFullYear(now.getFullYear() - 1);

  return points.filter((p) => new Date(p.date) >= from);
}

export default function MyRentIncomeScreen() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartRange, setChartRange] = useState<'3m' | '6m' | '1y' | 'all'>('1y');

  const load = async () => {
    try {
      const res = await api.get('/users/me/rent-income-history');
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const totalEarned = useMemo(() => {
    return logs.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [logs]);

  const groupedLogs = useMemo<GroupedLogs[]>(() => {
    const groups: Record<string, LogEntry[]> = {};

    logs.forEach((item) => {
      const key = getMonthLabel(item.timestamp);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).map(([monthLabel, items]) => ({
      monthLabel,
      items,
    }));
  }, [logs]);

  const chartHistory = useMemo<ChartPoint[]>(() => {
    if (!logs.length) return [];

    const sorted = [...logs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const byDate: Record<string, number> = {};

    sorted.forEach((item) => {
      const dateKey = new Date(item.timestamp).toISOString().slice(0, 10);
      byDate[dateKey] = (byDate[dateKey] ?? 0) + item.amount;
    });

    let running = 0;
    return Object.entries(byDate).map(([date, value]) => {
      running += value;
      return {
        date,
        total: Math.round(running * 100) / 100,
      };
    });
  }, [logs]);

  const chartData = useMemo(() => {
    const filteredHistory = filterHistoryByRange(chartHistory, chartRange);
    if (!filteredHistory.length) return null;

    const maxPoints = 6;

    let shortened =
      filteredHistory.length <= maxPoints
        ? filteredHistory
        : filteredHistory
            .filter((_, idx) => idx % Math.ceil(filteredHistory.length / maxPoints) === 0)
            .slice(0, maxPoints);

    if (shortened.length === 1) {
      shortened = [...shortened];
    }

    return {
      labels: shortened.map((p) => formatChartLabel(p.date)),
      datasets: [{ data: shortened.map((p) => p.total) }],
    };
  }, [chartHistory, chartRange]);

  const chartWidth =
    Dimensions.get('window').width - theme.spacing.lg * 2 - theme.spacing.md * 2;

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Rental Income</Text>
        <Text style={styles.subtitle}>
          Track income generated from your rental properties
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryTopRow}>
          <View style={styles.summaryTitleWrap}>
            <Text style={styles.summaryCaption}>Total earned</Text>
            <Text style={styles.summaryAmount}>{money(totalEarned)}</Text>
          </View>

          <View style={styles.summaryIconCircle}>
            <Image source={growthIcon} style={styles.summaryIcon} resizeMode="contain" />
          </View>
        </View>

        <View style={styles.summaryBottomRow}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{logs.length}</Text>
            <Text style={styles.summaryStatLabel}>Payments</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>
              {logs.length ? money(totalEarned / logs.length) : '$0.00'}
            </Text>
            <Text style={styles.summaryStatLabel}>Average payout</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartTopRow}>
          <View>
            <Text style={styles.chartCardTitle}>Rental income growth</Text>
            <Text style={styles.chartCardAmount}>{money(totalEarned)}</Text>
          </View>

          <Text style={styles.chartIncomeHint}>Cumulative income</Text>
        </View>

        {chartData ? (
          <LineChart
            data={chartData}
            width={chartWidth}
            height={220}
            yAxisSuffix=" $"
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLines={false}
            fromZero={true}
            chartConfig={{
              backgroundColor: theme.colors.surface,
              backgroundGradientFrom: theme.colors.surface,
              backgroundGradientTo: theme.colors.surface,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(17, 163, 106, ${opacity})`,
              labelColor: () => theme.colors.textSecondary,
              propsForDots: {
                r: '3',
                strokeWidth: '1',
                stroke: theme.colors.primary,
              },
            }}
            bezier
            style={styles.chart}
          />
        ) : (
          <View style={styles.chartEmptyWrap}>
            <Text style={styles.emptyText}>No chart data for selected period</Text>
          </View>
        )}

        <View style={styles.chartTabsRow}>
          <Pressable
            onPress={() => setChartRange('3m')}
            style={[styles.chartTab, chartRange === '3m' && styles.chartTabActive]}
          >
            <Text
              style={[
                styles.chartTabText,
                chartRange === '3m' && styles.chartTabTextActive,
              ]}
            >
              3 month
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setChartRange('6m')}
            style={[styles.chartTab, chartRange === '6m' && styles.chartTabActive]}
          >
            <Text
              style={[
                styles.chartTabText,
                chartRange === '6m' && styles.chartTabTextActive,
              ]}
            >
              6 month
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setChartRange('1y')}
            style={[styles.chartTab, chartRange === '1y' && styles.chartTabActive]}
          >
            <Text
              style={[
                styles.chartTabText,
                chartRange === '1y' && styles.chartTabTextActive,
              ]}
            >
              1 year
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setChartRange('all')}
            style={[styles.chartTab, chartRange === 'all' && styles.chartTabActive]}
          >
            <Text
              style={[
                styles.chartTabText,
                chartRange === 'all' && styles.chartTabTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
        </View>
      </View>

      {logs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Image source={rentalIcon} style={styles.emptyIcon} resizeMode="contain" />
          <Text style={styles.emptyTitle}>No rental income yet</Text>
          <Text style={styles.emptyText}>
            Once rental payouts are made, they will appear here.
          </Text>
        </View>
      ) : (
        groupedLogs.map((group) => (
          <View key={group.monthLabel} style={styles.monthSection}>
            <Text style={styles.monthTitle}>{group.monthLabel}</Text>

            <View style={styles.monthCard}>
              {group.items.map((log, index) => {
                const isLast = index === group.items.length - 1;

                return (
                  <View key={`${log.timestamp}-${index}`} style={styles.itemRow}>
                    <View style={styles.itemLeft}>
                      <View style={styles.itemIconWrap}>
                        <Image
                          source={rentalIcon}
                          style={styles.itemIcon}
                          resizeMode="contain"
                        />
                      </View>

                      <View style={styles.itemTextWrap}>
                        <Text style={styles.propertyTitle} numberOfLines={1}>
                          {log.title}
                        </Text>
                        <Text style={styles.dateText}>
                          {formatDateTime(log.timestamp)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.itemRight}>
                      <Text style={styles.amountText}>+ {money(log.amount)}</Text>
                    </View>

                    {!isLast && <View style={styles.itemDivider} />}
                  </View>
                );
              })}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
  },

  loaderWrap: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },

  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '800',
    color: theme.colors.text,
  },

  subtitle: {
    marginTop: 4,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },

  summaryCard: {
    backgroundColor: '#14191D',
    borderRadius: 24,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },

  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  summaryTitleWrap: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },

  summaryCaption: {
    fontSize: theme.typography.sizes.sm,
    color: '#A1A3A5',
    fontWeight: '600',
  },

  summaryAmount: {
    marginTop: 6,
    fontSize: theme.typography.sizes.xxl,
    color: theme.colors.white,
    fontWeight: '800',
  },

  summaryIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  summaryIcon: {
    width: 24,
    height: 24,
  },

  summaryBottomRow: {
    marginTop: theme.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },

  summaryStat: {
    flex: 1,
  },

  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: theme.spacing.md,
  },

  summaryStatValue: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.white,
    fontWeight: '800',
  },

  summaryStatLabel: {
    marginTop: 4,
    fontSize: theme.typography.sizes.sm,
    color: '#A1A3A5',
    fontWeight: '500',
  },

  chartCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  chartTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },

  chartCardTitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },

  chartCardAmount: {
    marginTop: 4,
    fontSize: theme.typography.sizes.xl,
    color: theme.colors.text,
    fontWeight: '800',
  },

  chartIncomeHint: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.success,
    fontWeight: '700',
    marginLeft: theme.spacing.sm,
  },

  chart: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.radii.md,
  },

  chartEmptyWrap: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chartTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },

  chartTab: {
    flex: 1,
    backgroundColor: '#F3F3F3',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chartTabActive: {
    backgroundColor: '#111827',
  },

  chartTabText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },

  chartTabTextActive: {
    color: theme.colors.white,
  },

  monthSection: {
    marginBottom: theme.spacing.lg,
  },

  monthTitle: {
    marginBottom: theme.spacing.sm,
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.text,
    fontWeight: '700',
  },

  monthCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  itemRow: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },

  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: theme.spacing.md,
  },

  itemIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EAF7F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },

  itemIcon: {
    width: 20,
    height: 20,
  },

  itemTextWrap: {
    flex: 1,
  },

  propertyTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
  },

  dateText: {
    marginTop: 3,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },

  itemRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  amountText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: theme.colors.success,
  },

  itemDivider: {
    position: 'absolute',
    left: 56,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },

  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyIcon: {
    width: 32,
    height: 32,
    marginBottom: theme.spacing.sm,
    opacity: 0.8,
  },

  emptyTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },

  emptyText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
});