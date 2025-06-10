import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import api from '../api';

interface Trade {
  timestamp: string;
  shares: number;
  pricePerShare: number;
  propertyTitle: string;
}

const TradeHistoryScreen = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTrades = async () => {
    try {
      setLoading(true);
      const res = await api.get('/share-offers/transactions');
      setTrades(res.data);
    } catch {
      console.warn('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrades();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trade History</Text>
      {loading ? <ActivityIndicator /> : (
        <FlatList
          data={trades}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.text}>Property: {item.propertyTitle}</Text>
              <Text style={styles.text}>Shares: {item.shares}</Text>
              <Text style={styles.text}>Price/Share: ${item.pricePerShare.toFixed(2)}</Text>
              <Text style={styles.text}>Time: {new Date(item.timestamp).toLocaleString()}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

export default TradeHistoryScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  card: {
    padding: 12,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  text: { fontSize: 16 },
});
