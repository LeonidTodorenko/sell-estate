import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Alert,  TouchableOpacity
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { Picker } from '@react-native-picker/picker';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

interface UserTransaction {
  id: string;
  type: string;
  amount: number;
  shares?: number;
  propertyId?: string;
  propertyTitle?: string;
  timestamp: string;
  notes?: string;
}

const EVENT_TYPES = [
  { label: "All", value: "" },
  { label: "Investment", value: "investment" },
  { label: "Buyback", value: "buyback" },
  { label: "Buy from Market", value: "share_market_buy" },
  { label: "Sell on Market", value: "share_market_sell" },
  { label: "Deposit", value: "deposit" },
  { label: "Withdrawal", value: "withdrawal" },
];

export default function UserTransactionsScreen() {
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  //const [userId, setUserId] = useState('');
  const [type, setType] = useState('');
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [dateMode, setDateMode] = useState<'from' | 'to' | null>(null);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;

      const user = JSON.parse(stored);
      //setUserId(user.userId);

      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (fromDate) params.append('from', fromDate.toISOString());
      if (toDate) params.append('to', toDate.toISOString());

      const res = await api.get(`/users/transactions/user/${user.userId}?${params.toString()}`);
      setTransactions(res.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load transactions');
    }
  }, [type, fromDate, toDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleConfirmDate = (date: Date) => {
    setDatePickerVisible(false);
    if (dateMode === 'from') setFromDate(date);
    else if (dateMode === 'to') setToDate(date);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Transactions</Text>

      <Picker selectedValue={type} onValueChange={setType} style={styles.picker}>
        {EVENT_TYPES.map((et) => (
          <Picker.Item key={et.value} label={et.label} value={et.value} />
        ))}
      </Picker>

      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => { setDateMode('from'); setDatePickerVisible(true); }}>
          <Text style={styles.dateButton}>
            From: {fromDate ? fromDate.toDateString() : 'Select'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setDateMode('to'); setDatePickerVisible(true); }}>
          <Text style={styles.dateButton}>
            To: {toDate ? toDate.toDateString() : 'Select'}
          </Text>
        </TouchableOpacity>
      </View>

      <BlueButton title="Apply Filters" onPress={fetchTransactions} />

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
            <Text style={styles.type}>{item.type} — ${item.amount.toFixed(2)}</Text>
            {item.propertyTitle && <Text>🏠 {item.propertyTitle}</Text>}
            {item.shares != null && <Text>📊 Shares: {item.shares}</Text>}
            {item.notes && <Text>📝 {item.notes}</Text>}
          </View>
        )}
      />

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={() => setDatePickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#2a1602', display: 'none'  },
  picker: { marginBottom: 10 },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  dateButton: {
    backgroundColor: '#eee',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    fontSize: 16,
  },
  card: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  timestamp: {
    fontSize: 14,
    color: '#888',
  },
  type: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
});
