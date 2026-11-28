import AssetAllocation from '../components/AssetAllocation';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import DemoModeBanner from '../components/DemoModeBanner';
import { loadSession, type Session } from '../services/sessionStorage';
import theme from '../constants/theme';

type Report = {
  id: string;
  reportMonth: string;
  walletBalance: number;
  investmentValue: number;
  rentalIncome: number;
  totalCapital: number;
  capitalChange: number;
  commentary?: string;
};

export default function MonthlyReportsScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  useEffect(() => { loadSession().then(setSession).finally(() => setSessionLoaded(true)); }, []);
  const isDemo = session?.isDemo === true || session?.user?.isDemo === true;
  const demoCode = session?.demoCode ?? session?.user?.demoCode ?? null;
  const userId = session?.user?.userId ?? session?.user?.id;
  const path = isDemo ? '/demo/monthly-reports' : '/monthly-reports';
  const locale = 'en-US';
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });
  const snapshotDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const wallet = 'Wallet';
  const investments = 'Investments';
  const query = useQuery({
    queryKey: ['monthly-reports', path, userId],
    queryFn: async () => (await api.get<Report[]>(path!, { headers: { 'Accept-Language': locale } })).data,
    enabled: !!userId && !!path,
  });

  if (!sessionLoaded || query.isLoading) return <View style={styles.center}><ActivityIndicator
    accessibilityLabel={'Loading…'} color={theme.colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={path && userId ? <RefreshControl refreshing={query.isFetching} onRefresh={query.refetch} /> : undefined}>
      <DemoModeBanner isDemo={isDemo} demoCode={demoCode} />
      <Text style={styles.heading}>{'Monthly Reports'}</Text>
      <Text style={styles.subtitle}>{isDemo
        ? 'Month-by-month snapshots of your virtual capital.'
        : 'Month-by-month snapshots of your capital.'}</Text>
      {query.isError && <Text style={styles.error}>{'Unable to load reports. Pull down to retry.'}</Text>}
      {query.data?.map(report => <View key={report.id} style={styles.card}>
        <Text style={styles.month}>{snapshotDate.format(new Date(report.reportMonth.slice(0, 10)))}</Text>
        <Text style={styles.label}>{'Total capital'}</Text>
        <Text style={styles.total}>{money.format(report.totalCapital)}</Text>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>{'Capital change'}</Text>
          <Text style={[styles.change, report.capitalChange < 0 && styles.down]}>
            {report.capitalChange > 0 ? '+' : ''}{money.format(report.capitalChange)}
          </Text>
        </View>
        <View style={styles.row}><Text style={styles.label}>{wallet}</Text><Text style={styles.value}>{money.format(report.walletBalance)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>{investments}</Text><Text style={styles.value}>{money.format(report.investmentValue)}</Text></View>
        <View style={styles.row}>
          <Text style={styles.label}>{'Rental income to date'}</Text>
          <Text style={styles.value}>{money.format(report.rentalIncome)}</Text>
        </View>
        <AssetAllocation
          title={isDemo ? 'Demo capital composition' : 'Capital composition'}
          description={'Snapshot amounts in USD. The wallet includes credited rent.'}
          items={[{ label: wallet, value: report.walletBalance }, { label: investments, value: report.investmentValue }]}/>
        {!!report.commentary && <Text style={styles.subtitle}>{report.commentary}</Text>}
      </View>)}
      {!session || !path || query.data?.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{!session ? 'Sign in to view reports' : isDemo
            ? 'Your first demo report is on its way'
            : 'No monthly snapshots yet'}</Text>
          {session && isDemo && <Text style={styles.empty}>{'Monthly snapshots appear after a full demo month has been completed.'}</Text>}
        </View>
      ) : null}
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginVertical: 4 },
  month: { color: '#B8C0D4', fontSize: 15, fontWeight: '600' },
  total: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 8 },
  change: { color: '#43C59E', fontWeight: '700' },
  down: { color: '#EF6A6A' },
  divider: { height: 1, backgroundColor: '#272E3D', marginVertical: 12 },
  label: { color: '#8B93A7' },
  value: { color: '#E9ECF3', fontWeight: '600' },
  error: { color: '#EF6A6A', marginBottom: 14 },
  empty: { color: '#8B93A7', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyCard: { padding: 22, borderRadius: 16, backgroundColor: '#151A26', marginTop: 10 },
  emptyTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center' },
});
