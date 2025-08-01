import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Button, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import api from '../api';
import { LineChart } from 'react-native-chart-kit';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  timestamp: string;
  notes: string;
}

interface AssetStats {
  walletBalance: number;
  investmentValue: number;
  totalAssets: number;
  assetHistory: { date: string; total: number }[];
    rentalIncome: number; 
    rentIncomeHistory: { date: string; total: number }[];  
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

    const filtered = transactions.filter(t => {
      const matchType = typeFilter === 'all' || t.type === typeFilter;
      const matchDate = new Date(t.timestamp) >= sinceDate;
      return matchType && matchDate;
    });

    setFiltered(filtered);
  }, [transactions, typeFilter, daysBack]);

  const getColor = (type: string) => {
    if (['deposit', 'investment', 'share_market_sell'].includes(type)) return 'green';
    if (['withdrawal', 'share_market_buy', 'buyback'].includes(type)) return 'red';
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

 const dualChartData = stats?.assetHistory && stats?.rentIncomeHistory ? {
  labels: stats.assetHistory.map(p => new Date(p.date).toLocaleDateString()),
  datasets: [
    {
      data: stats.assetHistory.map(p => p.total),
      color: () => 'rgba(0, 128, 255, 1)', // синяя — активы
      strokeWidth: 2,
    },
    {
      data: stats.rentIncomeHistory.map(p => p.total),
      color: () => 'rgba(0, 200, 0, 1)', // зелёная — аренда
      strokeWidth: 2,
    },
  ],
  legend: ['Total Assets', 'Rent Income'],
} : null;


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
        </Picker>

        <Text>Show last:</Text>
        <View style={styles.btnRow}>
          {[7, 30, 90].map(d => (
            <Button key={d} title={`${d} days`} onPress={() => setDaysBack(d)} />
          ))}
        </View>
      </>
    }
    data={filtered}
    keyExtractor={(item) => item.id}
    renderItem={renderItem}
    ListEmptyComponent={<Text style={styles.empty}>No transactions found.</Text>}
   ListFooterComponent={
  dualChartData && (
    <>
      <Text style={styles.chartTitle}>Asset Growth & Rent</Text>
      <LineChart
        data={dualChartData}
        width={Dimensions.get('window').width - 32}
        height={240}
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
  )
}
  />
);

};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
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
