import React, { useEffect, useState } from 'react';
import { View, Text,  Button, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import api from '../api';
import { RootStackParamList } from '../navigation/AppNavigator';
import StyledInput from '../components/StyledInput';

type BuyRouteProp = RouteProp<RootStackParamList, 'BuyShares'>;

const BuySharesScreen = () => {
  const route = useRoute<BuyRouteProp>();
  const navigation = useNavigation();
  const propertyId = route.params.propertyId;

  const [amount, setAmount] = useState('');
  const [sharePrice, setSharePrice] = useState<number | null>(null);
  const [pinOrPassword, setPinOrPassword] = useState('');

  useEffect(() => {
    const loadProperty = async () => {
      try {
        const res = await api.get(`/properties`);
        const prop = res.data.find((p: any) => p.id === propertyId);
        if (!prop) return Alert.alert('Error', 'Property not found');

        const pricePerShare = prop.price / prop.totalShares;
        setSharePrice(pricePerShare);
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to load property');
      }
    };

    loadProperty();
  }, [propertyId]);

  const handleBuy = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return Alert.alert('Invalid', 'Enter valid amount');

    if (sharePrice && parsed % sharePrice !== 0) {
      return Alert.alert('Invalid amount', `Investment must be a multiple of ${sharePrice.toFixed(2)} USD`);
    }

    const requestedShares = Math.round(parsed / sharePrice!);

    const stored = await AsyncStorage.getItem('user');
    if (!stored) return Alert.alert('Error', 'No user found');

    const user = JSON.parse(stored);

    if (!pinOrPassword) {
      return Alert.alert('Validation', 'Enter PIN or password');
    }

    try {
      await api.post('/investments/apply', {
        userId: user.userId,
        propertyId,
        requestedShares,
        requestedAmount: parsed,
        pinOrPassword,
      });

      Alert.alert('Success', 'Investment submitted');
      navigation.goBack();
    }
       catch (error: any) {
                 let message = 'Failed to invest ';
                      console.error(error);
                      if (error.response && error.response.data) {
                        message = JSON.stringify(error.response.data);
                      } else if (error.message) {
                        message = error.message;
                      }
                      Alert.alert('Error', 'Failed to invest ' + message);
                    console.error(message);
              }
    
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buy Shares</Text>
      {sharePrice && <Text>Price per share: {sharePrice.toFixed(2)} USD</Text>}
      <StyledInput
        style={styles.input}
        placeholder="Amount to invest"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      <StyledInput
        style={styles.input}
        placeholder="PIN or Password"
        secureTextEntry
        value={pinOrPassword}
        onChangeText={setPinOrPassword}
      />
      <Button title="Invest" onPress={handleBuy} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginVertical: 10,
    borderRadius: 6,
  },
});

export default BuySharesScreen;
