import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
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

  const [shares, setShares] = useState('');
  const [sharePrice, setSharePrice] = useState<number | null>(null);
  const [pinOrPassword, setPinOrPassword] = useState('');
  const [isFirstStep, setIsFirstStep] = useState(false);

  useEffect(() => {
    const checkIfFirstStep = async () => {
      try {
        const res = await api.get(`/properties/${propertyId}/payment-plans`);
        const plans = res.data;

        const now = new Date();
        const active = plans.find((p: any) => new Date(p.eventDate) <= now && now <= new Date(p.dueDate));
        const earliest = plans.reduce((min: any, p: any) => {
          return new Date(p.eventDate) < new Date(min.eventDate) ? p : min;
        }, plans[0]);

        if (active && active.eventDate === earliest.eventDate) {
          setIsFirstStep(true);
        }
      } catch (error: any) {
              let message = 'Failed to check step ';
                          console.error(error);
                          if (error.response && error.response.data) {
                            message = JSON.stringify(error.response.data);
                          } else if (error.message) {
                            message = error.message;
                          }
                          Alert.alert('Error', 'Failed to check step ' + message);
                        console.error(message);
      }
    };

    checkIfFirstStep();
  }, [propertyId]);

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
    const parsedShares = parseInt(shares, 10);
    if (!parsedShares || parsedShares <= 0) {
      return Alert.alert('Validation', 'Enter a valid number of shares (whole number > 0)');
    }
 
    const requestedAmount = sharePrice! * parsedShares;

    if (!pinOrPassword) {
      return Alert.alert('Validation', 'Enter PIN or password');
    }

    if (isFirstStep) {
      Alert.alert(
        'Warning',
        'You submit an investment request - it will be reviewed and confirmed later. The funds are temporarily debited.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Ок',
            onPress: () => executeBuy(parsedShares, requestedAmount)
          },
        ]
      );
    } else {
      executeBuy(parsedShares, requestedAmount);
    }
  };

  const executeBuy = async (parsedShares: number, requestedAmount: number) => {
          const stored = await AsyncStorage.getItem('user');
      if (!stored) return Alert.alert('Error', 'No user found');

      const user = JSON.parse(stored);

    try {
      await api.post('/investments/apply', {
        userId: user.userId,
        propertyId,
        requestedShares: parsedShares,
        requestedAmount,
        pinOrPassword,
      });

      Alert.alert('Success', 'Investment submitted');
      navigation.goBack();
    } catch (error: any) {
      let message = 'Failed to invest ';
      if (error.response && error.response.data) {
        message = JSON.stringify(error.response.data);
      } else if (error.message) {
        message = error.message;
      }
      Alert.alert('Error', message);
    }
  };


  const parsedShares = parseInt(shares, 10);
  const calculatedAmount = sharePrice && parsedShares > 0 ? (parsedShares * sharePrice).toFixed(2) : '0.00';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buy Shares</Text>
      {sharePrice && <Text>Price per share: {sharePrice.toFixed(2)} USD</Text>}
      <StyledInput
        style={styles.input}
        placeholder="Shares"
        keyboardType="numeric"
        value={shares}
        onChangeText={setShares}
      />
      <StyledInput
        style={[styles.input, { backgroundColor: '#eee' }]}
        value={`${calculatedAmount} USD`}
        editable={false}
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
