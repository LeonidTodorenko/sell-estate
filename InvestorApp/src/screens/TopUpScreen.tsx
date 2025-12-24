import React, { useState } from 'react';
import { View, Text,   StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import StyledInput from '../components/StyledInput';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

const TopUpScreen = () => {
  const [amount, setAmount] = useState('');
  const [pinOrPassword, setPinOrPassword] = useState('');

  const handleTopUp = async () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      return Alert.alert('Invalid', 'Enter a valid amount');
    }

    if (!pinOrPassword) {
      return Alert.alert('Missing', 'Enter your PIN or password');
    }

    const stored = await AsyncStorage.getItem('user');
    if (!stored) return Alert.alert('Error', 'User not found');

    const user = JSON.parse(stored);

    try {
      await api.post('/users/wallet/topup', {
        userId: user.userId,
        amount: parsed,
        pinOrPassword,
      });

      Alert.alert('Success', 'Balance topped up');
      setAmount('');
      setPinOrPassword('');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Top-up failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transfer Money</Text>
      <StyledInput
        style={styles.input}
        placeholder="Enter amount"
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
      <BlueButton title="Transfer Money" onPress={handleTopUp} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 ,backgroundColor: theme.colors.background},
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
