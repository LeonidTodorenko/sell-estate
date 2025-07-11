import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

interface Investment {
  id: string;
  propertyId: string;
  shares: number;
  investedAmount: number;
  createdAt: string;
}

const MyInvestmentsScreen = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);

  useEffect(() => {
    const loadInvestments = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        if (!stored) return;

        const user = JSON.parse(stored);
        const response = await api.get(`/investments/user/${user.userId}`);
        setInvestments(response.data);
      } catch (error) {
        console.error('Failed to load investments', error);
      }
    };

    loadInvestments();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Investments</Text>
      <FlatList
        data={investments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>Property ID: {item.propertyId}</Text>
            <Text>Shares: {item.shares}</Text>
            <Text>Invested: {item.investedAmount} USD</Text>
            <Text>Date: {new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No investments yet.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
  },
});

export default MyInvestmentsScreen;
