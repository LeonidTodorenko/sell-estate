import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput, Button,
} from 'react-native';
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
  const [filtered, setFiltered] = useState<Investment[]>([]);
  const [minShares, setMinShares] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [daysBack, setDaysBack] = useState('30');

  useEffect(() => {
    const loadInvestments = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        if (!stored) return;

        const user = JSON.parse(stored);
        const response = await api.get(`/investments/user/${user.userId}`);
        
        const sorted = response.data.sort((a: Investment, b: Investment) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setInvestments(sorted);
        setFiltered(sorted);
      } catch (error) {
        console.error('Failed to load investments', error);
      }
    };

    loadInvestments();
  }, []);

  const applyFilters = () => {
    const now = new Date();
    const sinceDate = new Date();
    sinceDate.setDate(now.getDate() - parseInt(daysBack || '0', 10));

    const minS = parseInt(minShares, 10) || 0;
    const minA = parseFloat(minAmount) || 0;

    const filteredData = investments.filter(i =>
      i.shares >= minS &&
      i.investedAmount >= minA &&
      new Date(i.createdAt) >= sinceDate
    );

    setFiltered(filteredData);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Investments</Text>

      <View style={styles.filters}>
  <View style={styles.filterGroup}>
    <Text style={styles.label}>Min Shares:</Text>
    <TextInput
      style={styles.input}
      keyboardType="numeric"
      value={minShares}
      onChangeText={setMinShares}
    />
  </View>

  <View style={styles.filterGroup}>
    <Text style={styles.label}>Min Amount:</Text>
    <TextInput
      style={styles.input}
      keyboardType="numeric"
      value={minAmount}
      onChangeText={setMinAmount}
    />
  </View>

  <View style={styles.filterGroup}>
    <Text style={styles.label}>Last X days:</Text>
    <TextInput
      style={styles.input}
      keyboardType="numeric"
      value={daysBack}
      onChangeText={setDaysBack}
    />
  </View>

  <Button title="Apply Filters" onPress={applyFilters} />
</View>


      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>Property ID: {item.propertyId}</Text>
            <Text>Shares: {item.shares}</Text>
            <Text>Invested: {item.investedAmount.toFixed(2)} USD</Text>
            <Text>Date: {new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 20 }}>No investments match your filters.</Text>
        }
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
  filters: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    padding: 8,
    marginVertical: 6,
    borderRadius: 6,
  },
  label: {
  fontWeight: 'bold',
  marginBottom: 4,
},
filterGroup: {
  marginBottom: 12,
},
});

export default MyInvestmentsScreen;
