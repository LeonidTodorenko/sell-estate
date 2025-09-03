// screens/RentHistoryScreen.tsx

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TextInput,   Platform, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../api';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

type RentHistoryRouteProp = RouteProp<RootStackParamList, 'RentHistory'>;

interface LogEntry {
  fullName: string;
  timestamp: string;
  amount: number;
}

const RentHistoryScreen = () => {
  const route = useRoute<RentHistoryRouteProp>();
  const { propertyId } = route.params;

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('');
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const formatDate = (date: Date | null) =>
    date ? date.toISOString().split('T')[0] : '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (userFilter) params.fullName = userFilter;
      if (fromDate) params.from = formatDate(fromDate);
      if (toDate) params.to = formatDate(toDate);

      const res = await api.get(`/properties/${propertyId}/rent-history`, { params });
      setLogs(res.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load rent history');
    } finally {
      setLoading(false);
    }
  }, [propertyId, userFilter, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>💸 Rent Payout History</Text>

      {/* ФИЛЬТРЫ */}
      <View style={styles.filters}>
        <TextInput
          style={styles.input}
          placeholder="Filter by name"
          value={userFilter}
          onChangeText={setUserFilter}
        />

        <TouchableOpacity onPress={() => setShowFromPicker(true)}>
          <Text style={styles.dateButton}>📅 From: {formatDate(fromDate) || 'Select'}</Text>
        </TouchableOpacity>
        {showFromPicker && (
          <DateTimePicker
            value={fromDate || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, selected) => {
              setShowFromPicker(false);
              if (selected) setFromDate(selected);
            }}
          />
        )}

        <TouchableOpacity onPress={() => setShowToPicker(true)}>
          <Text style={styles.dateButton}>📅 To: {formatDate(toDate) || 'Select'}</Text>
        </TouchableOpacity>
        {showToPicker && (
          <DateTimePicker
            value={toDate || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, selected) => {
              setShowToPicker(false);
              if (selected) setToDate(selected);
            }}
          />
        )}

        <BlueButton title="🔍 Filter" onPress={load} />
      </View>

      {/* СПИСОК */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : logs.length === 0 ? (
        <Text>No payouts found.</Text>
      ) : (
        logs.map((log, index) => (
          <View key={index} style={styles.card}>
            <Text style={styles.user}>👤 {log.fullName}</Text>
            <Text style={styles.amount}>💰 {log.amount.toFixed(2)} USD</Text>
            <Text style={styles.date}>📅 {new Date(log.timestamp).toLocaleString()}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16,backgroundColor: theme.colors.background },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  user: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  amount: { fontSize: 16, color: 'green', marginBottom: 2 },
  date: { fontSize: 14, color: 'gray' },
  filters: {
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  dateButton: {
    padding: 8,
    backgroundColor: '#eee',
    borderRadius: 6,
    marginBottom: 8,
  },
});

export default RentHistoryScreen;
