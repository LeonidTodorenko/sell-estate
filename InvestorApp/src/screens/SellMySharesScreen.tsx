// SellMySharesScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

interface Investment {
  id: string;
  propertyId: string;
  shares: number;
  investedAmount: number;
  createdAt: string;
  propertyTitle: string;
}

const SellMySharesScreen = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        if (!stored) return;
        const user = JSON.parse(stored);
        const res = await api.get(`/investment/user/${user.userId}/with-property`);
        setInvestments(res.data);
      } catch (err) {
        console.error('Error loading investments', err);
      }
    };
    load();
  }, []);

  const handleListOnMarket = (inv: Investment) => {
    Alert.prompt(
      'Set Price',
      `Enter price per share for "${inv.propertyTitle}" (${inv.shares} shares owned):`,
      async (priceInput) => {
        const price = parseFloat(priceInput || '0');
        if (!price || price <= 0) {
          Alert.alert('Invalid price');
          return;
        }

        try {
          const stored = await AsyncStorage.getItem('user');
          const user = stored ? JSON.parse(stored) : null;
          if (!user) return;

          await api.post('/share-offers', {
            investmentId: inv.id,
            sellerId: user.userId,
            propertyId: inv.propertyId,
            sharesForSale: inv.shares,
            pricePerShare: price,
            expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          });
          Alert.alert('Success', 'Offer listed on marketplace');
        } catch (err) {
          Alert.alert('Error', 'Failed to list offer');
        }
      },
      'plain-text'
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sell My Shares</Text>
      <FlatList
        data={investments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>Property: {item.propertyTitle}</Text>
            <Text>Shares: {item.shares}</Text>
            <Text>Invested: ${item.investedAmount}</Text>
            <Button title="List on Marketplace" onPress={() => handleListOnMarket(item)} />
            {/* Здесь позже появится вторая кнопка "Sell for buyback price" */}
          </View>
        )}
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

export default SellMySharesScreen;
