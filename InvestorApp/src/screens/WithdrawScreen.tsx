import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import StyledInput from '../components/StyledInput';

const WithdrawScreen = () => {
  const [amount, setAmount] = useState('');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleWithdraw = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return Alert.alert('Session error', 'User not found');

      const user = JSON.parse(stored);
      await api.post('/withdrawals/request', {
        userId: user.userId,
        amount: parseFloat(amount),
      });

      Alert.alert('Success', 'Withdrawal request submitted');
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to submit withdrawal');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Request Withdrawal</Text>
      <StyledInput
        style={styles.input}
        placeholder="Amount (USD)"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      <Button title="Submit Request" onPress={handleWithdraw} />
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

export default WithdrawScreen;
