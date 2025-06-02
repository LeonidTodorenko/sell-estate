import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Button, Alert, TextInput, Modal
} from 'react-native';
import api from '../api';
import { formatCurrency } from '../utils/format';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useNavigation } from '@react-navigation/native';
// import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import { RootStackParamList } from '../navigation/AppNavigator';

interface ShareOffer {
  id: string;
  sellerId: string;
  propertyId: string;
  propertyTitle: string;
  pricePerShare: number;
  sharesForSale: number;
  isActive: boolean;
  expirationDate: string;
}

interface ShareOfferBid {
  id: string;
  offerId: string;
  bidderId: string;
  bidPricePerShare: number;
  shares: number;
  createdAt: string;
}

const ShareMarketplaceScreen = () => {
  const [offers, setOffers] = useState<ShareOffer[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<ShareOffer[]>([]);
  const [bidsMap, setBidsMap] = useState<{ [offerId: string]: ShareOfferBid[] }>({});
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [bidModalVisible, setBidModalVisible] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<ShareOffer | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  //const [bidShares, setBidShares] = useState('');
  // const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [searchTitle, setSearchTitle] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const loadOffers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/share-offers/active');
      setOffers(res.data);
      setFilteredOffers(res.data);
    } catch {
      Alert.alert('Error', 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const loadUserId = async () => {
    const stored = await AsyncStorage.getItem('user');
    const user = stored ? JSON.parse(stored) : null;
    if (user) setUserId(user.userId);
  };

  const loadBidsForOffer = async (offerId: string) => {
    try {
      const res = await api.get(`/share-offers/${offerId}/bids`);
      setBidsMap(prev => ({ ...prev, [offerId]: res.data }));
    } catch {
      console.warn('Failed to load bids');
    }
  };

  const openBidModal = (offer: ShareOffer) => {
    setCurrentOffer(offer);
    setBidPrice('');
   // setBidShares('');
    setBidModalVisible(true);
  };

  const submitBid = async () => {
    const price = parseFloat(bidPrice);
   

    if (!currentOffer) return;

     const shares = currentOffer.sharesForSale; // parseInt(bidShares, 10);

    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid price');
      return;
    }

    // if (isNaN(shares) || shares <= 0 || shares > currentOffer.sharesForSale) {
    //   Alert.alert('Invalid share count');
    //   return;
    // }

    try {
      const stored = await AsyncStorage.getItem('user');
      const user = stored ? JSON.parse(stored) : null;
      if (!user) return;

      await api.post(`/share-offers/${currentOffer.id}/bid`, {
        bidderId: user.userId,
        bidPricePerShare: price,
        shares,
      });

      Alert.alert('Success', 'Bid placed');
      setBidModalVisible(false);
      loadBidsForOffer(currentOffer.id);
    } catch (error: any) {
      console.error(JSON.stringify(error.response.data));
      Alert.alert('Error', 'Failed to place bid');
    }
  };

  const handleBuyNow = async (offer: ShareOffer) => {
    Alert.alert(
      'Confirm Purchase',
      `Buy ${offer.sharesForSale} shares for ${formatCurrency(offer.pricePerShare)} per share?`,
      [
        { text: 'Cancel' },
        {
          text: 'Buy',
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem('user');
              const user = stored ? JSON.parse(stored) : null;
              if (!user) return;

              await api.post(`/share-offers/${offer.id}/buy?buyerId=${user.userId}&sharesToBuy=${offer.sharesForSale}`);

              Alert.alert('Success', 'Purchase completed');
              loadOffers();
            } catch (error: any) {
              console.error(error.response?.data);
              Alert.alert('Error', 'Purchase failed');
            }
          }
        }
      ]
    );
  };

  const handleAcceptBid = async (bid: ShareOfferBid) => {
    Alert.alert(
      'Accept Bid',
      `Sell ${bid.shares} shares for ${formatCurrency(bid.bidPricePerShare)} per share?`,
      [
        { text: 'Cancel' },
        {
          text: 'Confirm', onPress: async () => {
            try {
              await api.post(`/share-offers/bid/${bid.id}/accept?sharesToSell=${bid.shares}`);
              Alert.alert('Success', 'Bid accepted');
              loadOffers();
              loadBidsForOffer(bid.offerId);
            } catch {
              Alert.alert('Error', 'Failed to accept bid');
            }
          }
        }
      ]
    );
  };

  const applyFilters = useCallback(() => {
    const min = parseFloat(minPrice) || 0;
    const max = parseFloat(maxPrice) || Infinity;
    const filtered = offers.filter(o =>
      o.propertyTitle.toLowerCase().includes(searchTitle.toLowerCase()) &&
      o.pricePerShare >= min &&
      o.pricePerShare <= max
    );
    setFilteredOffers(filtered);
  }, [offers, searchTitle, minPrice, maxPrice]);

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
        } catch (error: any) {
          console.error(error);
          Alert.alert('Error', 'Failed to update price');
        }
      },
      'plain-text',
      item.pricePerShare.toString()
    );
  };

  useEffect(() => {
    loadUserId();
    loadOffers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Marketplace</Text>
      {/* <Button title="Sell My Shares" onPress={() => navigation.navigate('SellMyShares')} /> */}

      <View style={styles.filterPanel}>
        <TextInput placeholder="Search by property" value={searchTitle} onChangeText={setSearchTitle} style={styles.input} />
        <TextInput placeholder="Min Price" keyboardType="numeric" value={minPrice} onChangeText={setMinPrice} style={styles.input} />
        <TextInput placeholder="Max Price" keyboardType="numeric" value={maxPrice} onChangeText={setMaxPrice} style={styles.input} />
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
              <>
                <Button title="Place Bid" onPress={() => openBidModal(item)} />
                <View style={{ height: 10 }} />
                <Button title="Buy Now" onPress={() => handleBuyNow(item)} />
              </>
            )}

            {item.sellerId === userId && (
              <>
                <View style={{ height: 10 }} />
                <Button title="Cancel Listing" onPress={() => cancelOffer(item.id)} />
                <View style={{ height: 10 }} />
                <Button title="Extend 7 Days" onPress={() => extendOffer(item.id, 7)} />
                <View style={{ height: 10 }} />
                <Button title="Update Price" onPress={() => promptPriceUpdate(item)} />
                <View style={{ height: 10 }} />
                <Button title="Load Bids" onPress={() => loadBidsForOffer(item.id)} />
              </>
            )}

            {bidsMap[item.id]?.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontWeight: 'bold' }}>Bids:</Text>
                {bidsMap[item.id].map((bid) => (
                  <View key={bid.id} style={{ marginTop: 4, padding: 6, borderColor: '#ddd', borderWidth: 1, borderRadius: 6 }}>
                    <Text>Price: {formatCurrency(bid.bidPricePerShare)}</Text>
                    <Text>Shares: {bid.shares}</Text>
                    <Text>At: {new Date(bid.createdAt).toLocaleString()}</Text>
                    {item.sellerId === userId && (
                      <Button title="Accept" onPress={() => handleAcceptBid(bid)} />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      />

      <Modal visible={bidModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Place a Bid</Text>
            <TextInput
              style={styles.input}
              placeholder="Price per share"
              keyboardType="numeric"
              value={bidPrice}
              onChangeText={setBidPrice}
            />
            {/* <TextInput
              style={styles.input}
              placeholder={`Shares (max ${currentOffer?.sharesForSale ?? ''})`}
              keyboardType="numeric"
              value={bidShares}
              onChangeText={setBidShares}
            /> */}
            <Button title="Submit" onPress={submitBid} />
            <View style={{ height: 10 }} />
            <Button title="Cancel" onPress={() => setBidModalVisible(false)} />
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '80%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
});
