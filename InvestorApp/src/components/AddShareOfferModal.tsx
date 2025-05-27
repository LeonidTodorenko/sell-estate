import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Modal, Alert, ActivityIndicator } from 'react-native';
import api from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Investment {
  id: string;
  propertyId: string;
  propertyTitle: string;
  shares: number;
  investedAmount: number;
}

const AddShareOfferModal = ({ visible, onClose, onSuccess }: Props) => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState('');
  const [sharesForSale, setSharesForSale] = useState('');
  const [pricePerShare, setPricePerShare] = useState('');
  const [expirationDays, setExpirationDays] = useState('7');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) loadInvestments();
  }, [visible]);

  const loadInvestments = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      const user = stored ? JSON.parse(stored) : null;
      if (!user) return;

      const res = await api.get(`/investments/user/${user.userId}`);
      setInvestments(res.data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load investments');
    }
  };

  const handleSubmit = async () => {
    const shares = parseInt(sharesForSale);
    const price = parseFloat(pricePerShare);
    const days = parseInt(expirationDays);

    if (!selectedInvestmentId || isNaN(shares) || isNaN(price) || isNaN(days)) {
      Alert.alert('Validation', 'Please fill all fields correctly.');
      return;
    }

    const investment = investments.find(i => i.id === selectedInvestmentId);
    if (!investment || shares > investment.shares) {
      Alert.alert('Invalid', 'You cannot sell more shares than you own.');
      return;
    }

    setLoading(true);
    try {
      const stored = await AsyncStorage.getItem('user');
      const user = stored ? JSON.parse(stored) : null;
      if (!user) return;

      await api.post('/share-offers', {
        investmentId: investment.id,
        propertyId: investment.propertyId,
        sellerId: user.userId,
        sharesForSale: shares,
        pricePerShare: price,
        expirationDate: new Date(Date.now() + days * 86400000).toISOString(),
      });

      Alert.alert('Success', 'Offer created');
      onSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to create offer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <Text style={styles.title}>Sell Shares</Text>

        {investments.map(inv => (
          <Button
            key={inv.id}
            title={`[${inv.propertyTitle}] ${inv.shares} shares`}
            onPress={() => setSelectedInvestmentId(inv.id)}
            color={selectedInvestmentId === inv.id ? 'green' : undefined}
          />
        ))}

        <TextInput
          placeholder="Shares to sell"
          keyboardType="numeric"
          value={sharesForSale}
          onChangeText={setSharesForSale}
          style={styles.input}
        />
        <TextInput
          placeholder="Price per share"
          keyboardType="numeric"
          value={pricePerShare}
          onChangeText={setPricePerShare}
          style={styles.input}
        />
        <TextInput
          placeholder="Days until expiration"
          keyboardType="numeric"
          value={expirationDays}
          onChangeText={setExpirationDays}
          style={styles.input}
        />

        {loading ? (
          <ActivityIndicator />
        ) : (
          <Button title="Create Offer" onPress={handleSubmit} />
        )}

        <Button title="Close" color="gray" onPress={onClose} />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginVertical: 6,
    borderRadius: 6,
  },
});

export default AddShareOfferModal;
