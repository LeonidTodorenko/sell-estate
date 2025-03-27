import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import api from '../api';

interface Stats {
  investors: number;
  totalInvestments: number;
  totalProperties: number;
  totalRentalIncome: number;
  pendingWithdrawals: number;
  pendingKyc: number;
}

const AdminStatsScreen = () => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await api.get('/admin/stats');
        setStats(res.data);
      } catch (err) {
        Alert.alert('Error', 'Failed to load stats');
      }
    };

    loadStats();
  }, []);

  if (!stats) {
    return <Text style={styles.loading}>Loading stats...</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text>👤 Investors: {stats.investors}</Text>
      <Text>💰 Total Investments: {stats.totalInvestments} USD</Text>
      <Text>🏠 Properties: {stats.totalProperties}</Text>
      <Text>📤 Rental Income Paid: {stats.totalRentalIncome} USD</Text>
      <Text>⏳ Pending Withdrawals: {stats.pendingWithdrawals}</Text>
      <Text>📄 Pending KYC: {stats.pendingKyc}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  loading: { flex: 1, textAlign: 'center', marginTop: 100 },
});

export default AdminStatsScreen;
