import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Button, Alert, TextInput
} from 'react-native';
import api from '../api';
import { formatCurrency } from '../utils/format';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

interface ShareOffer {
  id: string;
  investmentId: string;
  sellerId: string;
  propertyId: string;
  propertyTitle: string;
  pricePerShare: number;
  sharesForSale: number;
  isActive: boolean;
  expirationDate: string;
}

const ShareMarketplaceScreen = () => {
  const [offers, setOffers] = useState<ShareOffer[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<ShareOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
   const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Filters
  const [searchTitle, setSearchTitle] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const applyFilters  = useCallback(() => {
    const min = parseFloat(minPrice) || 0;
    const max = parseFloat(maxPrice) || Infinity;
    const filtered = offers.filter(o =>
      o.propertyTitle.toLowerCase().includes(searchTitle.toLowerCase()) &&
      o.pricePerShare >= min &&
      o.pricePerShare <= max
    );
    setFilteredOffers(filtered);
 }, [offers, searchTitle, minPrice, maxPrice]);

  const loadOffers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/share-offers/active');
      setOffers(res.data);
      setFilteredOffers(res.data); // init
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
          if (!user) return;

          await api.post(`/share-offers/${offer.id}/buy?buyerId=${user.userId}&sharesToBuy=${count}`);
          Alert.alert('Success', 'Purchase complete');
          loadOffers();
        } catch (e) {
          Alert.alert('Error', 'Failed to buy shares');
        }
      },
      'plain-text'
    );
  };

  const cancelOffer = async (id: string) => {
  try {
    await api.post(`/share-offers/${id}/cancel`);
    Alert.alert('Offer canceled');
    loadOffers();
  } catch {
    Alert.alert('Error', 'Failed to cancel offer');
  }
};

const extendOffer = async (id: string, days: number) => {
  try {
    await api.post(`/share-offers/${id}/extend?days=${days}`);
    Alert.alert('Offer extended');
    loadOffers();
  } catch {
    Alert.alert('Error', 'Failed to extend offer');
  }
};

const promptPriceUpdate = (item: ShareOffer) => {
  Alert.prompt(
    'Update Price',
    `Current: ${item.pricePerShare}. Enter new price:`,
    async (input) => {
      const newPrice = parseFloat(input || '0');
      if (isNaN(newPrice) || newPrice <= 0) {
        Alert.alert('Invalid price');
        return;
      }
      try {
        await api.post(`/share-offers/${item.id}/update-price?newPrice=${newPrice}`);
        Alert.alert('Price updated');
        loadOffers();
      } catch {
        Alert.alert('Error', 'Failed to update price');
      }
    },
    'plain-text',
    item.pricePerShare.toString()
  );
};


  useEffect(() => {
    const loadUserId = async () => {
      const stored = await AsyncStorage.getItem('user');
      const user = stored ? JSON.parse(stored) : null;
      if (user) setUserId(user.userId);
    };

    loadUserId();
    loadOffers();
  }, []);

  useEffect(() => {
  applyFilters();
}, [applyFilters]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Marketplace</Text>
        <View style={{ height: 10 }} />
      <Button title="Sell My Shares" onPress={() => navigation.navigate('SellMyShares')} />
          <View style={{ height: 10 }} />
      {/* Filter Panel */}
      <View style={styles.filterPanel}>
        <TextInput
          placeholder="Search by property"
          value={searchTitle}
          onChangeText={setSearchTitle}
          style={styles.input}
        />
        <TextInput
          placeholder="Min Price"
          keyboardType="numeric"
          value={minPrice}
          onChangeText={setMinPrice}
          style={styles.input}
        />
        <TextInput
          placeholder="Max Price"
          keyboardType="numeric"
          value={maxPrice}
          onChangeText={setMaxPrice}
          style={styles.input}
        />
      </View>

      <FlatList
        data={filteredOffers}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadOffers}
        ListEmptyComponent={<Text>No matching offers</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.text}>Property: {item.propertyTitle}</Text>
            <Text style={styles.text}>Price/Share: {formatCurrency(item.pricePerShare)}</Text>
            <Text style={styles.text}>Shares Available: {item.sharesForSale}</Text>
            <Text style={styles.text}>Expires: {new Date(item.expirationDate).toLocaleDateString()}</Text>
            {item.sellerId !== userId && (
              <Button title="Buy" onPress={() => handleBuy(item)} />
            )}
            {item.sellerId === userId && (
                <>
                  <Button title="Cancel Listing" onPress={() => cancelOffer(item.id)} />
                     <View style={{ height: 10 }} />
                  <Button title="Extend 7 Days" onPress={() => extendOffer(item.id, 7)} />
                     <View style={{ height: 10 }} />
                  <Button title="Update Price" onPress={() => promptPriceUpdate(item)} />
                </>
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
    marginBottom: 12,
  },
  text: { fontSize: 16, marginBottom: 4 },
  filterPanel: {
    marginBottom: 12,
    backgroundColor: '#f2f2f2',
    padding: 12,
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
});
