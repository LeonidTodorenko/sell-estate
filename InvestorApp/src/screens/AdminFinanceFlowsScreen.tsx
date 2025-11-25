import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import api from '../api';
import theme from '../constants/theme';
import BlueButton from '../components/BlueButton';

import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type LineItem = {
  date: string;
  propertyId?: string | null;
  propertyTitle?: string | null;
  kind: string;   // Outflow:PaymentPlan | Inflow:Rent | Inflow:Sale | Inflow:User
  label: string;
  amount: number; // + inflow, - outflow
};

type Period = {
  period: string;              // ISO дата первого числа месяца
  requiredOutflow: number;
  availableOnDate: number;
  shortfall: number;
  items: LineItem[];
  // вспомогательное поле для inline-раскрытия:
  _expanded?: boolean;
};

type Forecast = {
  superUserBalance: number;
  periods: Period[];
};

const fmtMoney = (v: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

type Nav = NativeStackNavigationProp<RootStackParamList, 'AdminFinanceFlows'>;

export default function AdminFinanceFlowsScreen() {
  const navigation = useNavigation<Nav>();

  const [data, setData] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Forecast>('/admin/finance/forecast', {
        params: {
          // from: '2025-10-01', to: '2026-03-01'
        }
      });
      setData(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: Period }) => {
    const periodDate = new Date(item.period);
    const periodStr = periodDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    const danger = item.shortfall > 0;
    const ym = format(periodDate, 'yyyy-MM');

    return (
      <View style={[styles.card, danger && styles.cardDanger]}>
        <View style={styles.rowBetween}>
          <Text style={styles.period}>{periodStr}</Text>
          {danger ? (
            <Text style={styles.badgeDanger}>Shortfall {fmtMoney(item.shortfall)}</Text>
          ) : (
            <Text style={styles.badgeOk}>OK</Text>
          )}
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Required:</Text>
          <Text style={styles.value}>{fmtMoney(item.requiredOutflow)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Available on date:</Text>
          <Text style={styles.value}>{fmtMoney(item.availableOnDate)}</Text>
        </View>

        {/* КНОПКИ: inline-детали и переход на детальный экран */}
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => {
              (item as any)._expanded = !(item as any)._expanded;
              setData(d => d ? ({ ...d, periods: [...d.periods] }) : d);
            }}
          >
            <Text style={styles.detailsText}>Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.detailsBtn, { borderColor: '#0a84ff' }]}
            onPress={() => navigation.navigate('AdminFinanceMonth', { ym })}
          >
            <Text style={[styles.detailsText, { color: '#0a84ff' }]}>Open month</Text>
          </TouchableOpacity>
        </View>

        {/* inline-раскрытие */}
        {item._expanded && (
          <View style={styles.items}>
            {item.items.map((li, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={[styles.kind, li.kind.startsWith('Outflow') ? styles.kindOut : styles.kindIn]}>
                  {li.kind.replace(':', ' · ')}
                </Text>
                <Text style={styles.itemLabel} numberOfLines={1}>
                  {li.label}{li.propertyTitle ? ` · ${li.propertyTitle}` : ''}
                </Text>
                <Text style={[styles.itemAmount, li.amount < 0 ? styles.neg : styles.pos]}>
                  {fmtMoney(li.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Finance Flows</Text>

      <View style={styles.topRow}>
        <Text style={styles.suLabel}>Superuser balance:</Text>
        <Text style={styles.suValue}>{fmtMoney(data?.superUserBalance ?? 0)}</Text>
        <View style={{ flex: 1 }} />
        <BlueButton title="Refresh" onPress={load} />
      </View>

      {loading && <ActivityIndicator size="large" />}

      {!!data && (
        <FlatList
          data={data.periods}
          keyExtractor={(p) => p.period}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12 },

  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  suLabel: { fontWeight: '600', marginRight: 6 },
  suValue: { fontWeight: '700' },

  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginVertical: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd'
  },
  cardDanger: { borderColor: '#ff6b6b', backgroundColor: '#fff5f5' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  period: { fontSize: 16, fontWeight: '700' },
  badgeDanger: { color: '#b00020', fontWeight: '700' },
  badgeOk: { color: '#2e7d32', fontWeight: '700' },

  row: { flexDirection: 'row', marginTop: 4 },
  label: { width: 150, color: '#666' },
  value: { fontWeight: '700' },

  detailsBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1, borderColor: '#bbb'
  },
  detailsText: { fontWeight: '600' },

  items: { marginTop: 8, gap: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  kind: { minWidth: 130, fontWeight: '700' },
  kindIn: { color: '#1b5e20' },
  kindOut: { color: '#b00020' },
  itemLabel: { flex: 1, color: '#333' },
  itemAmount: { minWidth: 120, textAlign: 'right', fontVariant: ['tabular-nums'] },
  pos: { color: '#1b5e20' },
  neg: { color: '#b00020' },
});
