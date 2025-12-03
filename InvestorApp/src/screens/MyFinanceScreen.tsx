import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet,  Dimensions,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import api from '../api';
import { LineChart } from 'react-native-chart-kit';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

// import { loadSession, saveSession } from '../services/sessionStorage';
// import { writeLegacyUser } from '../api';

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

   clubStatus?: string;
  hasReferrer?: boolean;
  clubFeePercent?: number;
  baseFeePercent?: number;
  referralFeePercent?: number;
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

       // 1) Берём сессию, а не legacy
      //let session = await loadSession();
      //let userId = session?.user?.id ?? session?.user?.userId ?? null;

      //   console.log("session:"); // todo debug
      //   console.log(session); // todo debug
      //   console.log("end session:"); // todo debug

      //  console.log("userid:"); // todo debug
      //   console.log(userId); // todo debug
      //   console.log("end userid:"); // todo debug

      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;

      const user = JSON.parse(stored);
      try {
        // console.log("user:"); // todo debug
        // console.log(user); // todo debug
        // console.log("emd:"); // todo debug
        const [trxRes, statRes] = await Promise.all([
          api.get(`/users/transactions/user/${user.userId}`),
          api.get(`/users/${user.userId}/assets-summary`)
        ]);
        setTransactions(trxRes.data);
        setStats(statRes.data);
      }  
      catch (error: any) {
            let message = 'Failed to load finance data ';
            console.error(error);
            if (error.response && error.response.data) {
              message = JSON.stringify(error.response.data);
            } else if (error.message) {
              message = error.message;
            }
            Alert.alert('Error', 'Failed to load finance data ' + message);
          }
      finally {
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

  // const getColor = (type: string) => {
  //   const t = type.toLowerCase();
  //   if (['deposit', 'investment', 'share_market_sell'].includes(t)) return 'green';
  //   if (['withdrawal', 'share_market_buy', 'buyback'].includes(t)) return 'red';
  //   if (t === 'rent_income' || t === 'rentincome') return 'green';
  //   return 'black';
  // };

  const getColor = (type: string) => {
  const t = type.toLowerCase();
  if (['deposit', 'share_market_sell', 'rent_income', 'referral_reward', 'club_fee_income'].includes(t))    return 'green';
  if (['withdrawal', 'share_market_buy', 'buyback', 'investment', 'referral_code_purchase'].includes(t))    return 'red';
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
 
  const formatLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    // Вариант 1 (локализовано): "Sep 07"
   // return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });

    // Вариант 2 (жёстко "dd.MM"):
     const dd = String(d.getDate()).padStart(2, '0');
     const mm = String(d.getMonth() + 1).padStart(2, '0');
     return `${dd}.${mm}`;
  };

  const equityChart = useMemo(() => {
    if (!stats?.equityHistory?.length) return null;
    return {
      labels: stats.equityHistory.map(p => formatLabel(p.date)),
      datasets: [{ data: stats.equityHistory.map(p => p.total) }],
    };
  }, [stats]);

  const rentChart = useMemo(() => {
    if (!stats?.rentIncomeHistory?.length) return null;
    return {
       labels: stats.rentIncomeHistory.map(p => formatLabel(p.date)),
      datasets: [{ data: stats.rentIncomeHistory.map(p => p.total) }],
    };
  }, [stats]);

  const combinedChart = useMemo(() => {
    if (!stats?.combinedHistory?.length) return null;
    return {
       labels: stats.combinedHistory.map(p => formatLabel(p.date)),
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
              
              {stats.clubStatus && (
                <Text>
                  Club status: {stats.clubStatus}
                  {typeof stats.clubFeePercent === 'number' &&
                    ` (fee ${(stats.clubFeePercent * 100).toFixed(1)}%)`}
                </Text>
              )}

              {typeof stats.hasReferrer === 'boolean' && (
                <Text>Referral linked: {stats.hasReferrer ? 'yes' : 'no'}</Text>
              )}

              {typeof stats.baseFeePercent === 'number' && typeof stats.referralFeePercent === 'number' && (
              <Text>
                Platform fee on profit: base {(stats.baseFeePercent * 100).toFixed(1)}%
                {stats.hasReferrer && ` (with referrer: ${(stats.referralFeePercent * 100).toFixed(1)}%)`}
              </Text>
            )}


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
                width={Dimensions.get('window').width  }
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
                style={{ marginLeft:5, marginVertical: 20, borderRadius: 16 }}
              />
            </>
          )}

          {rentChart && (
            <>
              <Text style={styles.chartTitle}>🏠 Rent Income</Text>
              <LineChart
                data={rentChart}
                width={Dimensions.get('window').width }
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
                style={{marginLeft:5, marginBottom: 20, borderRadius: 16 }}
              />
            </>
          )}

          {combinedChart && (
            <>
              <Text style={styles.chartTitle}>🧮 Overall Growth (Assets + Rent)</Text>
              <LineChart
                data={combinedChart}
                width={Dimensions.get('window').width }
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
                style={{ marginLeft:5,marginBottom: 30, borderRadius: 16 }}
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
