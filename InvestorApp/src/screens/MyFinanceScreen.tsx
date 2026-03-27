import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
 
import { LineChart  } from 'react-native-gifted-charts';
import api from '../api';
import theme from '../constants/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { handleApiError } from '../utils/apiError';

interface HistoryPoint {
  date: string;   // yyyy-MM-dd
  total: number;
}

interface AssetStats {
  walletBalance: number;
  investmentValue: number;
  totalAssets: number;
  rentalIncome: number;

  assetHistory?: HistoryPoint[];
  equityHistory: HistoryPoint[];
  rentIncomeHistory: HistoryPoint[];
  combinedHistory: HistoryPoint[];
}

type RangeKey = '3m' | '6m' | '1y' | 'all';
type RentalRangeKey = '6m' | '1y' | 'all' | 'custom';

const screenWidth = Dimensions.get('window').width;

function parseDate(dateStr: string) {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function buildSimpleBars(points: HistoryPoint[]) {
  const sampled = samplePoints(points, 28);
  const max = Math.max(...sampled.map(p => p.total), 1);

  return sampled.map((p, index) => {
    const d = parseDate(p.date);
    const yearLabel =
      index % 7 === 0
        ? d.toLocaleDateString('en-US', { year: 'numeric' })
        : '';

    return {
      id: `${p.date}-${index}`,
      value: Number(p.total.toFixed(2)),
      heightPercent: Math.max(6, (p.total / max) * 100),
      yearLabel,
      dateLabel: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
  });
}

function formatMoney(value: number) {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatMoneyShort(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDelta(value: number) {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${formatMoney(Math.abs(value))}`;
}

function formatPercent(value: number) {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${Math.abs(value).toFixed(0)}%`;
}

function formatShortDate(dateStr: string) {
  const d = parseDate(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatPickerDate(date: Date | null) {
  if (!date) return 'Select date';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function filterHistoryByRange(points: HistoryPoint[], range: RangeKey): HistoryPoint[] {
  if (!points.length || range === 'all') return points;

  const lastDate = parseDate(points[points.length - 1].date);
  let fromDate = new Date(lastDate);

  if (range === '3m') fromDate = addMonths(lastDate, -3);
  if (range === '6m') fromDate = addMonths(lastDate, -6);
  if (range === '1y') fromDate = addYears(lastDate, -1);

  return points.filter((p) => parseDate(p.date) >= fromDate);
}

function filterHistoryByRentalRange(
  points: HistoryPoint[],
  range: RentalRangeKey,
  customStart: Date | null,
  customEnd: Date | null,
): HistoryPoint[] {
  if (!points.length) return points;

  if (range === 'all') return points;

  if (range === 'custom') {
    if (!customStart || !customEnd) return points;
    const start = new Date(customStart.getFullYear(), customStart.getMonth(), customStart.getDate());
    const end = new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate());

    return points.filter((p) => {
      const d = parseDate(p.date);
      return d >= start && d <= end;
    });
  }

  const lastDate = parseDate(points[points.length - 1].date);
  let fromDate = new Date(lastDate);

  if (range === '6m') fromDate = addMonths(lastDate, -6);
  if (range === '1y') fromDate = addYears(lastDate, -1);

  return points.filter((p) => parseDate(p.date) >= fromDate);
}

function buildSummary(points: HistoryPoint[]) {
  if (!points.length) {
    return {
      currentValue: 0,
      deltaValue: 0,
      deltaPercent: 0,
    };
  }

  const first = points[0].total;
  const last = points[points.length - 1].total;
  const deltaValue = last - first;
  const deltaPercent = first > 0 ? (deltaValue / first) * 100 : 0;

  return {
    currentValue: last,
    deltaValue,
    deltaPercent,
  };
}

function samplePoints(points: HistoryPoint[], maxPoints: number) {
  if (points.length <= maxPoints) return points;

  const result: HistoryPoint[] = [];
  const step = (points.length - 1) / (maxPoints - 1);

  for (let i = 0; i < maxPoints; i++) {
    const index = Math.round(i * step);
    result.push(points[index]);
  }

  return result;
}

function buildLineData(points: HistoryPoint[]) {
  const sampled = samplePoints(points, 6);

  return sampled.map((p, index) => ({
    value: Number(p.total.toFixed(2)),
    label: formatShortDate(p.date),
    dataPointText: '',
    customDataPoint: () => (
      <View style={styles.lineDot} />
    ),
    spacing: index === 0 ? 0 : undefined,
  }));
}

function buildBarData(points: HistoryPoint[]) {
  const sampled = samplePoints(points, 18);

  return sampled.map((p, index) => {
    const d = parseDate(p.date);
    const label =
      index % 4 === 0
        ? d.toLocaleDateString('en-US', { year: 'numeric' })
        : '';

    return {
      value: Number(p.total.toFixed(2)),
      label,
      frontColor: '#10B981',
      spacing: index === 0 ? 8 : 10,
    };
  });
}

const RangeButton = ({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.rangeButton, active && styles.rangeButtonActive]}
    >
      <Text style={[styles.rangeButtonText, active && styles.rangeButtonTextActive]}>
        {title}
      </Text>
    </Pressable>
  );
};

const StatCard = ({
  title,
  currentValue,
  deltaValue,
  deltaPercent,
  children,
  footer,
}: {
  title: string;
  currentValue: number;
  deltaValue: number;
  deltaPercent: number;
  children: React.ReactNode;
  footer: React.ReactNode;
}) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>

      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.bigValue}>{formatMoney(currentValue)}</Text>
          <Text style={styles.currentValueLabel}>Current value</Text>
        </View>

        <Text style={styles.deltaValue}>
          {formatDelta(deltaValue)} ({formatPercent(deltaPercent).replace('+', '')})
        </Text>
      </View>

      {children}

      {footer}
    </View>
  );
};

const MyFinanceScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [stats, setStats] = useState<AssetStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [overallRange, setOverallRange] = useState<RangeKey>('1y');
  const [propertyRange, setPropertyRange] = useState<RangeKey>('1y');
  const [rentalRange, setRentalRange] = useState<RentalRangeKey>('all');

  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);

  const [rangeModalVisible, setRangeModalVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        if (!stored) {
          setLoading(false);
          return;
        }

        const user = JSON.parse(stored);

        const statRes = await api.get(`/users/${user.userId}/assets-summary`, {
          errorContext: 'Failed to load assets-summary',
          errorTitle: 'Assets-summary',
        } as any);

        setStats(statRes.data);
      } catch (e) {
        handleApiError(e, 'Failed to load finance data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const overallHistory = useMemo(() => {
    if (!stats?.combinedHistory?.length) return [];
    return filterHistoryByRange(stats.combinedHistory, overallRange);
  }, [stats, overallRange]);

  const propertyHistory = useMemo(() => {
    if (!stats?.equityHistory?.length) return [];
    return filterHistoryByRange(stats.equityHistory, propertyRange);
  }, [stats, propertyRange]);

  const rentalHistory = useMemo(() => {
    if (!stats?.rentIncomeHistory?.length) return [];
    return filterHistoryByRentalRange(
      stats.rentIncomeHistory,
      rentalRange,
      customStart,
      customEnd,
    );
  }, [stats, rentalRange, customStart, customEnd]);

  const overallSummary = useMemo(() => buildSummary(overallHistory), [overallHistory]);
  const propertySummary = useMemo(() => buildSummary(propertyHistory), [propertyHistory]);
  const rentalSummary = useMemo(() => buildSummary(rentalHistory), [rentalHistory]);

  const overallLineData = useMemo(() => buildLineData(overallHistory), [overallHistory]);
  const propertyLineData = useMemo(() => buildLineData(propertyHistory), [propertyHistory]);
  const rentalBarData = useMemo(() => buildSimpleBars(rentalHistory), [rentalHistory]);
  const rentalRangeLabel = useMemo(() => {
    if (rentalRange !== 'custom' || !customStart || !customEnd) return '';

    const start = customStart.toLocaleDateString('en-GB');
    const end = customEnd.toLocaleDateString('en-GB');
    return `${start} – ${end}`;
  }, [rentalRange, customStart, customEnd]);

  const applyCustomRange = () => {
    if (!customStart || !customEnd) {
      Alert.alert('Validation', 'Please select start and end dates');
      return;
    }

    if (customStart > customEnd) {
      Alert.alert('Validation', 'Start date must be before end date');
      return;
    }

    setRentalRange('custom');
    setRangeModalVisible(false);
  };

  const onChangePicker = (_event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setPickerTarget(null);
    }

    if (!selectedDate) return;

    if (pickerTarget === 'start') {
      setCustomStart(selectedDate);
    } else if (pickerTarget === 'end') {
      setCustomEnd(selectedDate);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.emptyText}>No statistics available</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.headerShell}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={26} color="#171717" />
            </Pressable>

            <Text style={styles.headerTitle}>Statistics</Text>

            <View style={styles.headerRightPlaceholder} />
          </View>
        </View>

        <StatCard
          title="Overall Growth"
          currentValue={overallSummary.currentValue}
          deltaValue={overallSummary.deltaValue}
          deltaPercent={overallSummary.deltaPercent}
          footer={
            <View style={styles.rangeRow}>
              <RangeButton
                title="3 month"
                active={overallRange === '3m'}
                onPress={() => setOverallRange('3m')}
              />
              <RangeButton
                title="6 month"
                active={overallRange === '6m'}
                onPress={() => setOverallRange('6m')}
              />
              <RangeButton
                title="1 year"
                active={overallRange === '1y'}
                onPress={() => setOverallRange('1y')}
              />
              <RangeButton
                title="All"
                active={overallRange === 'all'}
                onPress={() => setOverallRange('all')}
              />
            </View>
          }
        >
          <View style={styles.chartWrap}>
            {overallLineData.length > 0 ? (
              <LineChart
                areaChart
                curved
                hideDataPoints={false}
                data={overallLineData}
                width={screenWidth - 82}
                height={220}
                color="#A7E6A7"
                startFillColor="rgba(16,185,129,0.22)"
                endFillColor="rgba(16,185,129,0.10)"
                startOpacity={0.5}
                endOpacity={0.08}
                thickness={3}
                hideRules={false}
                rulesColor="rgba(34,197,94,0.20)"
                rulesType="dashed"
                yAxisColor="transparent"
                xAxisColor="transparent"
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={styles.axisText}
                noOfSections={4}
                maxValue={Math.max(...overallLineData.map((x) => x.value), 1)}
                pointerConfig={{ activatePointersOnLongPress: false }}
              />
            ) : (
              <View style={styles.emptyChart}>
                <Text style={styles.emptyChartText}>No data for selected period</Text>
              </View>
            )}
          </View>
        </StatCard>

        <StatCard
          title="Rental income"
          currentValue={rentalSummary.currentValue}
          deltaValue={rentalSummary.deltaValue}
          deltaPercent={rentalSummary.deltaPercent}
          footer={
            <>
              <View style={styles.rangeRow}>
                <RangeButton
                  title="6 month"
                  active={rentalRange === '6m'}
                  onPress={() => setRentalRange('6m')}
                />
                <RangeButton
                  title="1 year"
                  active={rentalRange === '1y'}
                  onPress={() => setRentalRange('1y')}
                />
                <RangeButton
                  title="All"
                  active={rentalRange === 'all'}
                  onPress={() => setRentalRange('all')}
                />
                <RangeButton
                  title="Custom"
                  active={rentalRange === 'custom'}
                  onPress={() => setRangeModalVisible(true)}
                />
              </View>
            </>
          }
        >
          {!!rentalRangeLabel && (
            <Text style={styles.rangeLabel}>{rentalRangeLabel}</Text>
          )}

         <View style={[styles.chartWrap, { marginTop: rentalRangeLabel ? 8 : 20 }]}>
  {rentalBarData.length > 0 ? (
    <View style={styles.customBarChartWrap}>
      <View style={styles.customBarGrid}>
        <View style={styles.customBarRule} />
        <View style={styles.customBarRule} />
        <View style={styles.customBarRule} />
        <View style={styles.customBarRule} />
      </View>

      <View style={styles.customBarColumns}>
        {rentalBarData.map((bar) => (
          <View key={bar.id} style={styles.customBarColumn}>
            <View
              style={[
                styles.customBar,
                { height: `${bar.heightPercent}%` },
              ]}
            />
            {!!bar.yearLabel && (
              <Text style={styles.customBarYearLabel}>{bar.yearLabel}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  ) : (
    <View style={styles.emptyChart}>
      <Text style={styles.emptyChartText}>No data for selected period</Text>
    </View>
  )}
</View>
        </StatCard>

        <StatCard
          title="Property Value Growth"
          currentValue={propertySummary.currentValue}
          deltaValue={propertySummary.deltaValue}
          deltaPercent={propertySummary.deltaPercent}
          footer={
            <View style={styles.rangeRow}>
              <RangeButton
                title="3 month"
                active={propertyRange === '3m'}
                onPress={() => setPropertyRange('3m')}
              />
              <RangeButton
                title="6 month"
                active={propertyRange === '6m'}
                onPress={() => setPropertyRange('6m')}
              />
              <RangeButton
                title="1 Year"
                active={propertyRange === '1y'}
                onPress={() => setPropertyRange('1y')}
              />
              <RangeButton
                title="All"
                active={propertyRange === 'all'}
                onPress={() => setPropertyRange('all')}
              />
            </View>
          }
        >
          <View style={styles.chartWrap}>
            {propertyLineData.length > 0 ? (
              <LineChart
                areaChart
                curved
                hideDataPoints={false}
                data={propertyLineData}
                width={screenWidth - 82}
                height={220}
                color="#A7E6A7"
                startFillColor="rgba(16,185,129,0.22)"
                endFillColor="rgba(16,185,129,0.10)"
                startOpacity={0.5}
                endOpacity={0.08}
                thickness={3}
                hideRules={false}
                rulesColor="rgba(34,197,94,0.20)"
                rulesType="dashed"
                yAxisColor="transparent"
                xAxisColor="transparent"
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={styles.axisText}
                noOfSections={4}
                maxValue={Math.max(...propertyLineData.map((x) => x.value), 1)}
                pointerConfig={{ activatePointersOnLongPress: false }}
              />
            ) : (
              <View style={styles.emptyChart}>
                <Text style={styles.emptyChartText}>No data for selected period</Text>
              </View>
            )}
          </View>
        </StatCard>
      </ScrollView>

      <Modal
        visible={rangeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRangeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select period</Text>

            <Pressable
              style={styles.dateField}
              onPress={() => setPickerTarget('start')}
            >
              <Text style={styles.dateFieldText}>{formatPickerDate(customStart)}</Text>
              <Ionicons name="close" size={24} color="#171717" />
            </Pressable>

            <Pressable
              style={styles.dateField}
              onPress={() => setPickerTarget('end')}
            >
              <Text style={styles.dateFieldText}>{formatPickerDate(customEnd)}</Text>
              <Ionicons name="close" size={24} color="#171717" />
            </Pressable>

            {pickerTarget && (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={
                    pickerTarget === 'start'
                      ? customStart ?? new Date()
                      : customEnd ?? new Date()
                  }
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onChangePicker}
                />
              </View>
            )}

            <Pressable style={styles.continueButton} onPress={applyCustomRange}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default MyFinanceScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ECECEC',
  },

  content: {
    paddingBottom: 110,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ECECEC',
  },

  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },

  headerShell: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingTop: 52,
    paddingBottom: 18,
    marginBottom: 16,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },

  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#171717',
  },

  headerRightPlaceholder: {
    width: 36,
  },

  card: {
    backgroundColor: '#F8F8F8',
    borderRadius: 28,
    marginHorizontal: 12,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 16,
  },

  cardTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#171717',
    marginBottom: 20,
  },

  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  bigValue: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: '#171717',
  },

  currentValueLabel: {
    marginTop: 6,
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  deltaValue: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#10B981',
  },

  chartWrap: {
    marginTop: 14,
    alignItems: 'center',
  },

  axisText: {
    color: '#5B5B5B',
    fontSize: 11,
  },

  axisYearText: {
    color: '#A3A3A3',
    fontSize: 13,
  },

  lineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2DCD5D',
    borderWidth: 1,
    borderColor: '#2DCD5D',
  },

  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },

  rangeButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#E9E9E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },

  rangeButtonActive: {
    backgroundColor: '#05060D',
  },

  rangeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#171717',
  },

  rangeButtonTextActive: {
    color: '#FFFFFF',
  },

  rangeLabel: {
    textAlign: 'right',
    fontSize: 15,
    color: '#A3A3A3',
    fontWeight: '500',
    marginTop: 4,
  },

  emptyChart: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyChartText: {
    color: '#9CA3AF',
    fontSize: 14,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'flex-end',
  },

  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
    minHeight: 360,
  },

  sheetHandle: {
    width: 64,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#B8B8B8',
    alignSelf: 'center',
    marginBottom: 18,
  },

  sheetTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#171717',
    marginBottom: 22,
  },

  dateField: {
    height: 68,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
customBarChartWrap: {
  width: '100%',
  height: 270,
  justifyContent: 'flex-end',
  position: 'relative',
  paddingHorizontal: 8,
  paddingBottom: 28,
},

customBarGrid: {
  ...StyleSheet.absoluteFillObject,
  top: 12,
  bottom: 28,
  justifyContent: 'space-between',
},

customBarRule: {
  borderTopWidth: 1,
  borderColor: 'rgba(156,163,175,0.28)',
  borderStyle: 'dashed',
},

customBarColumns: {
  flexDirection: 'row',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  flex: 1,
},

customBarColumn: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'flex-end',
  height: '100%',
},

customBar: {
  width: 10,
  backgroundColor: '#10B981',
  borderTopLeftRadius: 4,
  borderTopRightRadius: 4,
  minHeight: 6,
},

customBarYearLabel: {
  marginTop: 10,
  fontSize: 12,
  color: '#A3A3A3',
  fontWeight: '500',
},
  dateFieldText: {
    fontSize: 18,
    color: '#171717',
    fontWeight: '500',
  },

  pickerWrap: {
    marginTop: 4,
    marginBottom: 18,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },

  continueButton: {
    marginTop: 8,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },

  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});