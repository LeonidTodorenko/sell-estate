import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet,  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import api from '../api';
import { LineChart } from 'react-native-chart-kit';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  timestamp: string;
  notes: string;
}

interface HistoryPoint {
  date: string;   // "yyyy-MM-dd"
  total: number;  // cumulative value
}

interface AssetStats {
  walletBalance: number;
  investmentValue: number;
  totalAssets: number;

  // агрегаты
  rentalIncome: number;

  // ряды
  equityHistory: HistoryPoint[];       // активы без аренды
  rentIncomeHistory: HistoryPoint[];   // только аренда
  combinedHistory: HistoryPoint[];     // equity + rent
}

const MyFinanceScreen = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filtered, setFiltered] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [daysBack, setDaysBack] = useState<number>(30);

  useEffect(() => {
    const loadData = async () => {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;

      const user = JSON.parse(stored);
      try {
        const [trxRes, statRes] = await Promise.all([
          api.get(`/users/transactions/user/${user.userId}`),
          api.get(`/users/${user.userId}/assets-summary`)
        ]);
        setTransactions(trxRes.data);
        setStats(statRes.data);
      } catch (error) {
        console.error('Failed to load finance data', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const now = new Date();
    const sinceDate = new Date(now.setDate(now.getDate() - daysBack));

    const filteredNow = transactions.filter(t => {
      const matchType = typeFilter === 'all' || t.type === typeFilter;
      const matchDate = new Date(t.timestamp) >= sinceDate;
      return matchType && matchDate;
    });

    setFiltered(filteredNow);
  }, [transactions, typeFilter, daysBack]);

  const getColor = (type: string) => {
    const t = type.toLowerCase();
    if (['deposit', 'investment', 'share_market_sell'].includes(t)) return 'green';
    if (['withdrawal', 'share_market_buy', 'buyback'].includes(t)) return 'red';
    if (t === 'rent_income' || t === 'rentincome') return 'green';
    return 'black';
  };

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={styles.card}>
      <Text style={[styles.type, { color: getColor(item.type) }]}>{item.type}</Text>
      <Text>Amount: ${item.amount.toFixed(2)}</Text>
      <Text>Date: {new Date(item.timestamp).toLocaleDateString()}</Text>
      <Text style={styles.notes}>{item.notes}</Text>
    </View>
  );

  const equityChart = useMemo(() => {
    if (!stats?.equityHistory?.length) return null;
    return {
      labels: stats.equityHistory.map(p => new Date(p.date).toLocaleDateString()),
      datasets: [{ data: stats.equityHistory.map(p => p.total) }],
    };
  }, [stats]);

  const rentChart = useMemo(() => {
    if (!stats?.rentIncomeHistory?.length) return null;
    return {
      labels: stats.rentIncomeHistory.map(p => new Date(p.date).toLocaleDateString()),
      datasets: [{ data: stats.rentIncomeHistory.map(p => p.total) }],
    };
  }, [stats]);

  const combinedChart = useMemo(() => {
    if (!stats?.combinedHistory?.length) return null;
    return {
      labels: stats.combinedHistory.map(p => new Date(p.date).toLocaleDateString()),
      datasets: [{ data: stats.combinedHistory.map(p => p.total) }],
    };
  }, [stats]);

  return (
    <FlatList
      ListHeaderComponent={
        <>
          <Text style={styles.title}>My Finances</Text>

          {stats && (
            <View style={styles.summaryBox}>
              <Text style={styles.asset}>Total Assets: ${stats.totalAssets.toFixed(2)}</Text>
              <Text>Wallet Balance: ${stats.walletBalance.toFixed(2)}</Text>
              <Text>Investments Value: ${stats.investmentValue.toFixed(2)}</Text>
              <Text>Rental Income: ${stats.rentalIncome.toFixed(2)}</Text>
            </View>
          )}

          <Text>Filter by type:</Text>
          <Picker selectedValue={typeFilter} onValueChange={setTypeFilter}>
            <Picker.Item label="All" value="all" />
            <Picker.Item label="Investment" value="investment" />
            <Picker.Item label="Deposit" value="deposit" />
            <Picker.Item label="Withdrawal" value="withdrawal" />
            <Picker.Item label="Market Buy" value="share_market_buy" />
            <Picker.Item label="Market Sell" value="share_market_sell" />
            <Picker.Item label="Buyback" value="buyback" />
            <Picker.Item label="Rent Income" value="rent_income" />
          </Picker>

          <Text>Show last:</Text>
          <View style={styles.btnRow}>
            {[7, 30, 90].map(d => (
              <BlueButton key={d} title={`${d} days`} onPress={() => setDaysBack(d)} />
            ))}
          </View>
        </>
      }
      data={filtered}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListEmptyComponent={<Text style={styles.empty}>No transactions found.</Text>}
      ListFooterComponent={
        <>
          {equityChart && (
            <>
              <Text style={styles.chartTitle}>📈 Asset Growth (without rent)</Text>
              <LineChart
                data={equityChart}
                width={Dimensions.get('window').width - 32}
                height={220}
                yAxisSuffix=" $"
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 2,
                  color: (opacity = 1) => `rgba(0, 128, 255, ${opacity})`,
                  labelColor: () => '#000',
                }}
                style={{ marginVertical: 20, borderRadius: 16 }}
              />
            </>
          )}

          {rentChart && (
            <>
              <Text style={styles.chartTitle}>🏠 Rent Income</Text>
              <LineChart
                data={rentChart}
                width={Dimensions.get('window').width - 32}
                height={220}
                yAxisSuffix=" $"
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 2,
                  color: (opacity = 1) => `rgba(0, 200, 0, ${opacity})`,
                  labelColor: () => '#000',
                }}
                style={{ marginBottom: 20, borderRadius: 16 }}
              />
            </>
          )}

          {combinedChart && (
            <>
              <Text style={styles.chartTitle}>🧮 Overall Growth (Assets + Rent)</Text>
              <LineChart
                data={combinedChart}
                width={Dimensions.get('window').width - 32}
                height={220}
                yAxisSuffix=" $"
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 2,
                  color: (opacity = 1) => `rgba(128, 0, 255, ${opacity})`,
                  labelColor: () => '#000',
                }}
                style={{ marginBottom: 30, borderRadius: 16 }}
              />
            </>
          )}
        </>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 ,backgroundColor: theme.colors.background},
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  summaryBox: {
    backgroundColor: '#eef',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  asset: { fontWeight: 'bold', fontSize: 16 },
  chartTitle: { textAlign: 'center', fontSize: 18, marginTop: 10 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    marginBottom: 10,
  },
  type: { fontWeight: 'bold', fontSize: 16 },
  notes: { fontStyle: 'italic', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 30, color: '#777' },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 8,
  },
});

export default MyFinanceScreen;
