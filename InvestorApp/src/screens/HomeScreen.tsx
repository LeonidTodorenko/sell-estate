import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import BlueButton from '../components/BlueButton';


type Totals = {
  walletBalance: number;
  investmentValue: number;
  pendingApplicationsValue: number;
  marketValue: number;
  rentalIncome: number;
  totalAssets: number;
};

export default function MainHomeScreen({ navigation }: any) {
  const [userFullName, setUserFullName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [totals, setTotals] = useState<Totals | null>(null);
  const [unread, setUnread] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const stored = await AsyncStorage.getItem('user');
    if (!stored) return;
    const u = JSON.parse(stored);
    setUserFullName(u.fullName || '');
    setUserId(u.userId);

    const [assetsRes, unreadRes] = await Promise.all([
      api.get(`/users/${u.userId}/total-assets`),
      api.get(`/messages/unread-count/${u.userId}`).catch(() => ({ data: { count: 0 } })),
    ]);

    const a = assetsRes.data;
    setTotals({
      walletBalance: a.walletBalance ?? 0,
      investmentValue: a.investmentValue ?? 0,
      pendingApplicationsValue: a.pendingApplicationsValue ?? 0,
      marketValue: a.marketValue ?? 0,
      rentalIncome: a.rentalIncome ?? 0,
      totalAssets: a.totalAssets ?? (a.walletBalance ?? 0) + (a.investmentValue ?? 0),
    });
    setUnread(unreadRes?.data?.count ?? 0);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Шапка */}
      <Text style={styles.hello}>🏠 Welcome{userFullName ? `, ${userFullName}` : ''}</Text>

      {/* Карточка “счета” */}
      <View style={styles.accountsCard}>
        <Text style={styles.cardTitle}>Accounts</Text>

        <View style={styles.row}>
          <Text style={styles.label}>💵 Cash (wallet):</Text>
          <Text style={styles.value}>
            {totals ? `$${totals.walletBalance.toFixed(2)}` : '—'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>📈 Investments (shares):</Text>
          <Text style={styles.value}>
            {totals ? `$${totals.investmentValue.toFixed(2)}` : '—'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>⏳ In transit:</Text>
          <Text style={styles.value}>
            {totals ? `$${totals.pendingApplicationsValue.toFixed(2)}` : '—'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>🛒 Listed on market:</Text>
          <Text style={styles.value}>
            {totals ? `$${totals.marketValue.toFixed(2)}` : '—'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>🏠 Rental income (cum.):</Text>
          <Text style={styles.value}>
            {totals ? `$${totals.rentalIncome.toFixed(2)}` : '—'}
          </Text>
        </View>

        <View style={styles.rowTotal}>
          <Text style={styles.totalLabel}>TOTAL ASSETS</Text>
          <Text style={styles.totalValue}>
            {totals ? `$${totals.totalAssets.toFixed(2)}` : '—'}
          </Text>
        </View>
      </View>

      {/* Быстрые ссылки (часть уже есть в проекте) */}
      <View style={{ height: 12 }} />

      <BlueButton icon="👤" title="Personal (settings)" onPress={() => navigation.navigate('Personal')} />
      
      <BlueButton icon="🏘️" title="Properties" onPress={() => navigation.navigate('Properties')} />

      <BlueButton icon="💹" title="Share" onPress={() => navigation.navigate('ShareMarketplaces')} />

      <View style={{ height: 8 }} />
      <BlueButton icon="💬" title={`Inbox${unread ? ` (${unread})` : ''}`} onPress={() => navigation.navigate('Inbox')} />

      <View style={{ height: 8 }} />
      <BlueButton icon="📊" title="Statistics" onPress={() => navigation.navigate('MyFinance')} />
      <BlueButton icon="💼" title="Investment" onPress={() => navigation.navigate('Investments')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  hello: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginVertical: 16 },
  accountsCard: {
    backgroundColor: '#eef6ff', // подберём цвет потом
    borderRadius: 12,
    padding: 14,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: '#cfe2ff' },
  label: { color: '#333' },
  value: { fontWeight: '600', color: '#111' },
  totalLabel: { fontWeight: '800', color: '#0a2a66' },
  totalValue: { fontWeight: '800', color: '#0a2a66' },
});
