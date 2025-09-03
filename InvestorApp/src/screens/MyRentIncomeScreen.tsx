import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import api from '../api';
import theme from '../constants/theme';

interface LogEntry {
  title: string;
  timestamp: string;
  amount: number;
}

const MyRentIncomeScreen = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/users/me/rent-income-history');
        setLogs(res.data);
      } catch (err) {
        Alert.alert('Error', 'Failed to load rent income');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 20 }} />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🏠 Rental Income</Text>
      {logs.length === 0 ? (
        <Text>No income records found.</Text>
      ) : (
        logs.map((log, index) => (
          <View key={index} style={styles.card}>
            <Text style={styles.titleText}>🏠 {log.title}</Text>
            <Text style={styles.amount}>💰 {log.amount.toFixed(2)} USD</Text>
            <Text style={styles.date}>📅 {new Date(log.timestamp).toLocaleString()}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16,backgroundColor: theme.colors.background },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
  },
  titleText: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  amount: { fontSize: 16, color: 'green', marginBottom: 2 },
  date: { fontSize: 14, color: 'gray' },
});

export default MyRentIncomeScreen;
