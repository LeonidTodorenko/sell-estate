import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

interface Investment {
  id: string;
  propertyId: string;
  shares: number;
  investedAmount: number;
  createdAt: string;
}

const InvestmentsScreen = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);

  const loadInvestments = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return Alert.alert('Error', 'No user found');

      const user = JSON.parse(stored);
      const response = await api.get(`/investments/user/${user.userId}`);
      setInvestments(response.data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load investments');
    }
  };

  useEffect(() => {
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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  card: {
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
});

export default InvestmentsScreen;
