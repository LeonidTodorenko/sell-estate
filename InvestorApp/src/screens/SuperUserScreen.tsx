import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, FlatList, Alert } from 'react-native';
import api from '../api';

interface Investment {
  propertyId: string;
  propertyTitle: string;
  shares: number;
  investedAmount: number;
}

const SuperUserScreen = () => {
  const [balance, setBalance] = useState(0);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [amount, setAmount] = useState('');

  const loadData = async () => {
    try {
      const res = await api.get('/admin/stats/superuser');
      setBalance(res.data.walletBalance);
      setInvestments(res.data.investments);
    }
    catch (error: any) {
      let message = 'Failed to load data';

      if (error instanceof Error) {
        message = error.message;
        console.error(error.stack);
      } else if (error?.response?.data) {
        message = JSON.stringify(error.response.data);
        console.error(error.response.data);
      } else {
        message = String(error);
        console.error('Raw error:', message);
      }

      Alert.alert('Error', 'Failed to load data: ' + message);
    }
  };

  const updateBalance = async (delta: number) => {
    try {
      await api.post(`/admin/stats/superuser/update-balance?delta=${delta}`);
      Alert.alert('Success', 'Balance updated');
      setAmount('');
      loadData();
    }
    catch (error: any) {
      let message = 'Failed to update balance';

      if (error instanceof Error) {
        message = error.message;
        console.error(error.stack);
      } else if (error?.response?.data) {
        message = JSON.stringify(error.response.data);
        console.error(error.response.data);
      } else {
        message = String(error);
        console.error('Raw error:', message);
      }

      Alert.alert('Error', 'Failed to update balance: ' + message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Superuser Wallet</Text>
      <Text style={styles.balance}>Balance: ${balance.toFixed(2)}</Text>

      <TextInput
        placeholder="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        style={styles.input}
      />

      <View style={styles.buttonRow}>
        <Button title="➕ Add" onPress={() => updateBalance(parseFloat(amount))} />
        <Button title="➖ Subtract" onPress={() => updateBalance(-parseFloat(amount))} />
      </View>

      <Text style={styles.subtitle}>Investments</Text>
      <FlatList
        data={investments}
        keyExtractor={(item) => item.propertyId}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.bold}>{item.propertyTitle}</Text>
            <Text>Shares: {item.shares}</Text>
            <Text>Amount: ${item.investedAmount.toFixed(2)}</Text>
          </View>
        )}
      />
    </View>
  );
};

export default SuperUserScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  balance: { fontSize: 18, marginBottom: 10 },
  input: {
    borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  card: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginBottom: 10,
  },
  bold: { fontWeight: 'bold' },
});
