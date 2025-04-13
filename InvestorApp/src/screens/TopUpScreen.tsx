import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

const TopUpScreen = () => {
  const [amount, setAmount] = useState('');

  const handleTopUp = async () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      return Alert.alert('Invalid', 'Enter a valid amount');
    }

    const stored = await AsyncStorage.getItem('user');
    if (!stored) return Alert.alert('Error', 'User not found');

    const user = JSON.parse(stored);

    try {
      await api.post('/users/wallet/topup', {
        userId: user.userId,
        amount: parsed,
      });

      Alert.alert('Success', 'Balance topped up');
      setAmount('');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Top-up failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Top Up Balance</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter amount"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      <Button title="Top Up" onPress={handleTopUp} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 20,
    borderRadius: 6,
  },
});

export default TopUpScreen;
