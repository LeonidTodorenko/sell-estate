import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import DemoModeBanner from '../components/DemoModeBanner';
import { loadSession } from '../services/sessionStorage';
import theme from '../constants/theme';

type Report = {
  id: string;
  reportMonth: string;
  walletBalance: number;
  investmentValue: number;
  rentalIncome: number;
  totalCapital: number;
  capitalChange: number;
};

const money = (value: number) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MonthlyReportsScreen() {
  const [session, setSession] = useState<any>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  useEffect(() => { loadSession().then(setSession).finally(() => setSessionLoaded(true)); }, []);
  const isDemo = session?.isDemo === true || session?.user?.isDemo === true;
  const demoCode = session?.demoCode ?? session?.user?.demoCode ?? null;
  const query = useQuery({
    queryKey: ['demo-monthly-reports'],
    queryFn: async () => (await api.get<Report[]>('/demo/monthly-reports')).data,
    enabled: sessionLoaded && isDemo,
  });

  if (query.isLoading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={query.refetch} />}>
      <DemoModeBanner isDemo={isDemo} demoCode={demoCode} />
      <Text style={styles.heading}>Monthly portfolio reports</Text>
      <Text style={styles.subtitle}>A month-by-month snapshot of your virtual capital.</Text>
      {query.isError && <Text style={styles.error}>Unable to load reports. Pull down to retry.</Text>}
      {query.data?.map(report => {
        const changeUp = report.capitalChange >= 0;
        return <View key={report.id} style={styles.card}>
          <View style={styles.row}><Text style={styles.month}>{report.reportMonth.slice(0, 7)}</Text><Text style={[styles.change, !changeUp && styles.down]}>{changeUp ? '+' : ''}{money(report.capitalChange)}</Text></View>
          <Text style={styles.total}>{money(report.totalCapital)}</Text>
          <View style={styles.divider} />
          <View style={styles.row}><Text style={styles.label}>Wallet</Text><Text style={styles.value}>{money(report.walletBalance)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Investments</Text><Text style={styles.value}>{money(report.investmentValue)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Rental income to date</Text><Text style={styles.value}>{money(report.rentalIncome)}</Text></View>
        </View>;
      })}
      {!query.isError && query.data?.length === 0 && <Text style={styles.empty}>No monthly reports yet.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 18, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  heading: { color: theme.colors.text, fontSize: 24, fontWeight: '700', marginTop: 18 },
  subtitle: { color: '#8B93A7', marginTop: 6, marginBottom: 18 },
  card: { backgroundColor: '#151A26', borderRadius: 16, padding: 18, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  month: { color: '#B8C0D4', fontSize: 15, fontWeight: '600' },
  total: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 8 },
  change: { color: '#43C59E', fontWeight: '700' },
  down: { color: '#EF6A6A' },
  divider: { height: 1, backgroundColor: '#272E3D', marginVertical: 12 },
  label: { color: '#8B93A7' },
  value: { color: '#E9ECF3', fontWeight: '600' },
  error: { color: '#EF6A6A', marginBottom: 14 },
  empty: { color: '#8B93A7', textAlign: 'center', marginTop: 30 },
});
