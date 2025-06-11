import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Button, Alert, Modal, TextInput, Pressable, Platform, TouchableOpacity
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import DateTimePicker from '@react-native-community/datetimepicker';

interface GroupedInvestment {
  propertyId: string;
  propertyTitle: string;
  shares: number;
  totalInvested: number;
  averagePrice: number;
  buybackPricePerShare: number | null;
}

type SellMySharesRouteProp = RouteProp<RootStackParamList, 'SellMyShares'>;

const SellMySharesScreen = () => {
  const route = useRoute<SellMySharesRouteProp>();
  const propertyId = route.params?.propertyId;
  const propertyName = route.params?.propertyName;

  const [investments, setInvestments] = useState<GroupedInvestment[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<GroupedInvestment | null>(null);
  const [inputShares, setInputShares] = useState('');
  const [inputStartPrice, setInputStartPrice] = useState('');
  const [inputBuyoutPrice, setInputBuyoutPrice] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date>(new Date(Date.now() + 7 * 86400000));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchBuybackPrices = useCallback(async (userId: string) => {
    const res = await api.get(`/share-offers/user/${userId}/grouped`);
    const all = res.data;
    const filtered = propertyId ? all.filter((i: GroupedInvestment) => i.propertyId === propertyId) : all;
    setInvestments(filtered);
  }, [propertyId]);

  useEffect(() => {
    const loadUserAndInvestments = async () => {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;
      const user = JSON.parse(stored);
      setUserId(user.userId);
      await fetchBuybackPrices(user.userId);
    };
    loadUserAndInvestments();
  }, [fetchBuybackPrices]);

  const handleSellToPlatform = async (inv: GroupedInvestment) => {
    if (!userId) return;

    Alert.alert(
      'Confirm Sale',
      `Sell ${inv.shares} shares of ${inv.propertyTitle} for $${(inv.buybackPricePerShare ?? 0 * inv.shares).toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sell',
          onPress: async () => {
            try {
              const res = await api.get(`/share-offers/user/${userId}/with-property`);
              const userInvestments = res.data.filter((x: any) => x.propertyId === inv.propertyId);
              for (const i of userInvestments) {
                await api.post('/share-offers/sell-to-platform', {
                  investmentId: i.id,
                  userId: userId,
                  sharesToSell: i.shares,
                });
              }
              Alert.alert('Success', 'Shares sold to platform');
              await fetchBuybackPrices(userId);
            } catch {
              Alert.alert('Error', 'Failed to sell shares');
            }
          },
        },
      ]
    );
  };

  const handleListOnMarketplace = (inv: GroupedInvestment) => {
    setSelectedProperty(inv);
    setInputShares('');
    setInputStartPrice('');
    setInputBuyoutPrice('');
    setExpirationDate(new Date(Date.now() + 7 * 86400000));
    setModalVisible(true);
  };

  const submitListing = async () => {
    const shares = parseInt(inputShares);
    const startPrice = parseFloat(inputStartPrice);
    const buyoutPrice = inputBuyoutPrice ? parseFloat(inputBuyoutPrice) : null;

    if (!selectedProperty || isNaN(shares) || shares <= 0 || isNaN(startPrice) || startPrice <= 0) {
      Alert.alert('Invalid input');
      return;
    }

    const daysDiff = Math.ceil((expirationDate.getTime() - Date.now()) / 86400000);
    if (daysDiff < 7) {
      Alert.alert('Minimum auction duration is 7 days');
      return;
    }

    try {
      await api.post('/share-offers', {
        sellerId: userId,
        propertyId: selectedProperty.propertyId,
        sharesForSale: shares,
        startPricePerShare: startPrice,
        buyoutPricePerShare: buyoutPrice,
        expirationDate: expirationDate.toISOString(),
      });

      Alert.alert('Success', 'Offer listed on marketplace');
      setModalVisible(false);
      await fetchBuybackPrices(userId);
    } catch {
      Alert.alert('Error', 'Failed to create offer');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sell Shares {propertyName ? `for ${propertyName}` : ''}</Text>
      <FlatList
        data={investments}
        keyExtractor={(item) => item.propertyId}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>Property: {item.propertyTitle}</Text>
            <Text>Shares: {item.shares}</Text>
            <Text>Total Invested: ${item.totalInvested.toFixed(2)}</Text>
            <Text>Average Price/Share: ${item.averagePrice.toFixed(2)}</Text>

            {item.buybackPricePerShare && (
              <Button
                title={`Sell for buyback price ($${item.buybackPricePerShare}/share)`}
                onPress={() => handleSellToPlatform(item)}
              />
            )}
            <View style={{ marginTop: 8 }}>
              <Button title="List on marketplace" onPress={() => handleListOnMarketplace(item)} />
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              List shares of {selectedProperty?.propertyTitle}
            </Text>

            <TextInput
              placeholder="Number of shares"
              value={inputShares}
              onChangeText={setInputShares}
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              placeholder="Start price per share"
              value={inputStartPrice}
              onChangeText={setInputStartPrice}
              keyboardType="numeric"
              style={[
                styles.input,
                selectedProperty && parseFloat(inputStartPrice) > 0 &&
                  parseFloat(inputStartPrice) < selectedProperty.averagePrice
                  ? styles.inputWarning
                  : {},
              ]}
            />
            {selectedProperty && parseFloat(inputStartPrice) > 0 &&
              parseFloat(inputStartPrice) < selectedProperty.averagePrice && (
                <Text style={styles.warningText}>⚠️ Price is below your average share price</Text>
              )}

            <TextInput
              placeholder="Buyout price per share (optional)"
              value={inputBuyoutPrice}
              onChangeText={setInputBuyoutPrice}
              keyboardType="numeric"
              style={styles.input}
            />

            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
              <TextInput
                style={styles.input}
                value={expirationDate.toDateString()}
                editable={false}
                pointerEvents="none"
              />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={expirationDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date(Date.now() + 7 * 86400000)}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setExpirationDate(selectedDate);
                }}
              />
            )}

            <View style={styles.btnRow}>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtn}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitListing}>
                <Text style={styles.confirmBtn}>Submit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '90%',
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 6,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  inputWarning: {
    borderColor: '#ff9900',
    backgroundColor: '#fff6e5',
  },
  warningText: {
    color: '#cc6600',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  cancelBtn: {
    color: 'red',
    fontWeight: 'bold',
    fontSize: 16,
  },
  confirmBtn: {
    color: 'green',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SellMySharesScreen;
