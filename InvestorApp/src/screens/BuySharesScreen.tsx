import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

type BuySharesScreenRouteProp = RouteProp<RootStackParamList, 'BuyShares'>;

const BuySharesScreen = () => {
  const route = useRoute<BuySharesScreenRouteProp>();
  const navigation = useNavigation();
  const { propertyId, propertyName } = route.params;

  const [amount, setAmount] = useState('');

  const handleBuy = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return Alert.alert('Session error', 'User not found');

      const user = JSON.parse(stored);
      const response = await api.post('/investment', {
        userId: user.userId,
        propertyId: propertyId,
        amount: parseFloat(amount),
      });
      console.log(response);
      // todo response
      Alert.alert('Success', 'Investment successful' );
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to invest');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invest in {propertyName}</Text>
      <TextInput
        style={styles.input}
        placeholder="Amount (USD)"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      <Button title="Buy Shares" onPress={handleBuy} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 20, marginBottom: 20, textAlign: 'center', fontWeight: 'bold' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 20,
  },
});

export default BuySharesScreen;
