import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Button, Alert } from 'react-native';
import api from '../api';
import { formatCurrency } from '../utils/format';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ShareOffer {
  id: string;
  investmentId: string;
  sellerId: string;
  propertyId: string;
  pricePerShare: number;
  sharesForSale: number;
  isActive: boolean;
  expirationDate: string;
}

const ShareMarketplaceScreen = () => {
  const [offers, setOffers] = useState<ShareOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUserId = async () => {
      const stored = await AsyncStorage.getItem('user');
      const user = stored ? JSON.parse(stored) : null;
      if (user) setUserId(user.userId);
    };

    loadUserId();
  }, []);
   
  const loadOffers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/share-offers/active');
      setOffers(res.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (offer: ShareOffer) => {
    Alert.prompt(
      'Buy Shares',
      `Enter number of shares to buy (max ${offer.sharesForSale}):`,
      async (input) => {
        const count = parseInt(input || '0', 10);
        if (isNaN(count) || count <= 0 || count > offer.sharesForSale) {
          Alert.alert('Invalid input');
          return;
        }

        try {
              const stored = await AsyncStorage.getItem('user');
               const user = stored ? JSON.parse(stored) : null;
             if (!user) return; // todo add error
 
          await api.post(`/share-offers/${offer.id}/buy?buyerId=${user.userId}&sharesToBuy=${count}`);
          Alert.alert('Success', 'Purchase complete');
          loadOffers(); // обновить список
        } catch (e) {
          Alert.alert('Error', 'Failed to buy shares');
        }
      },
      'plain-text'
    );
  };

  useEffect(() => {
    loadOffers();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Marketplace</Text>
      <FlatList
        data={offers}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadOffers}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.text}>Property ID: {item.propertyId}</Text>
            <Text style={styles.text}>Price/Share: {formatCurrency(item.pricePerShare)}</Text>
            <Text style={styles.text}>Shares Available: {item.sharesForSale}</Text>
            <Text style={styles.text}>Expires: {new Date(item.expirationDate).toLocaleDateString()}</Text>
            {item.sellerId !== userId && (
              <Button title="Buy" onPress={() => handleBuy(item)} />
            )}
          </View>
        )}
      />
    </View>
  );
};

export default ShareMarketplaceScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  text: {
    fontSize: 16,
    marginBottom: 4,
  },
});
