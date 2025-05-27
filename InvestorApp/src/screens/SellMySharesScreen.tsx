import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

interface Investment {
  id: string;
  propertyId: string;
  shares: number;
  investedAmount: number;
  propertyTitle: string;
}

interface ActiveOfferInfo {
  price: number;
  expires: string;
}

const SellMySharesScreen = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [buybackPrices, setBuybackPrices] = useState<Record<string, number | null>>({});
  const [activeOffers, setActiveOffers] = useState<Record<string, ActiveOfferInfo>>({});

  useEffect(() => {
    const loadUserAndInvestments = async () => {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;
      const user = JSON.parse(stored);
      setUserId(user.userId);

      const res = await api.get(`/investment/user/${user.userId}/with-property`);
      setInvestments(res.data);

      await loadActiveOffers(user.userId);
    };

    loadUserAndInvestments();
  }, []);

  useEffect(() => {
    const fetchBuybackPrices = async () => {
      const prices: Record<string, number | null> = {};
      for (const inv of investments) {
        try {
          const res = await api.get(`/properties/${inv.propertyId}/buyback-price`);
          prices[inv.propertyId] = res.data.buybackPrice;
        } catch {
          prices[inv.propertyId] = null;
        }
      }
      setBuybackPrices(prices);
    };

    if (investments.length > 0) {
      fetchBuybackPrices();
    }
  }, [investments]);

  const loadActiveOffers = async (userId: string) => {
    try {
      const res = await api.get(`/share-offers/user/${userId}/active`);
      const map: Record<string, ActiveOfferInfo> = {};
      for (const offer of res.data) {
        map[offer.investmentId] = {
          price: offer.pricePerShare,
          expires: offer.expirationDate,
        };
      }
      setActiveOffers(map);
    } catch (e) {
      console.error('Failed to load active offers');
    }
  };

  const handleSellToPlatform = async (inv: Investment) => {
    const buybackPrice = buybackPrices[inv.propertyId];
    if (!buybackPrice) {
      Alert.alert('No buyback price available');
      return;
    }

    Alert.alert(
      'Confirm Sale',
      `Sell ${inv.shares} shares of ${inv.propertyTitle} for $${(buybackPrice * inv.shares).toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sell',
          onPress: async () => {
            try {
              await api.post('/share-offers/sell-to-platform', {
                investmentId: inv.id,
                userId: userId,
                sharesToSell: inv.shares,
              });
              Alert.alert('Success', 'Shares sold to platform');
              const updated = await api.get(`/investment/user/${userId}/with-property`);
              setInvestments(updated.data);
              await loadActiveOffers(userId);
            } catch {
              Alert.alert('Error', 'Failed to sell shares');
            }
          },
        },
      ]
    );
  };

  const handleListOnMarketplace = (inv: Investment) => {
    Alert.prompt(
      'Set Price',
      `Enter price per share for "${inv.propertyTitle}" (${inv.shares} shares):`,
      async (priceInput) => {
        const price = parseFloat(priceInput || '0');
        if (!price || price <= 0) {
          Alert.alert('Invalid price');
          return;
        }

        try {
          const expirationDate = new Date();
          expirationDate.setDate(expirationDate.getDate() + 7);

          await api.post('/share-offers', {
            investmentId: inv.id,
            sellerId: userId,
            propertyId: inv.propertyId,
            sharesForSale: inv.shares,
            pricePerShare: price,
            expirationDate: expirationDate.toISOString(),
          });
          Alert.alert('Success', 'Offer listed on marketplace');
          await loadActiveOffers(userId);
        } catch {
          Alert.alert('Error', 'Failed to create offer');
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
        renderItem={({ item }) => {
          const buyback = buybackPrices[item.propertyId];
          const offer = activeOffers[item.id];

          return (
            <View style={styles.card}>
              <Text>Property: {item.propertyTitle}</Text>
              <Text>Shares: {item.shares}</Text>
              <Text>Invested: ${item.investedAmount}</Text>

              {offer ? (
                <>
                  <Text style={{ color: 'green', fontWeight: 'bold', marginTop: 6 }}>
                    🔵 Listed on marketplace
                  </Text>
                  <Text>Price: ${offer.price}/share</Text>
                  <Text>Expires: {new Date(offer.expires).toLocaleDateString()}</Text>
                </>
              ) : (
                <>
                  {buyback && (
                    <Button
                      title={`Sell for buyback price ($${buyback}/share)`}
                      onPress={() => handleSellToPlatform(item)}
                    />
                  )}
                  <View style={{ marginTop: 8 }}>
                    <Button title="List on marketplace" onPress={() => handleListOnMarketplace(item)} />
                  </View>
                </>
              )}
            </View>
          );
        }}
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
