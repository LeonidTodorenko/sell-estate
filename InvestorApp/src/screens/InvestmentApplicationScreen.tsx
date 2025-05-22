import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import api from '../api';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface InvestmentApplication {
  id: string;
  propertyId: string;
  requestedAmount: number;
  requestedShares: number;
  approvedAmount?: number;
  approvedShares?: number;
  status: string | null;
  isPriority: boolean;
  stepNumber: number;
  createdAt: string;
}

export default function InvestmentApplicationScreen() {
  const [applications, setApplications] = useState<InvestmentApplication[]>([]);
  const isFocused = useIsFocused();

  const fetchApplications = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      const user = stored ? JSON.parse(stored) : null;
      if (!user) return;

      const response = await api.get(`/applications/user/${user.userId}`);
      setApplications(response.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load applications');
    }
  };

  useEffect(() => {
    if (isFocused) fetchApplications();
  }, [isFocused]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Applications</Text>
      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.text}>Property ID: {item.propertyId}</Text>
            <Text style={styles.text}>Amount: ${item.requestedAmount}</Text>
            <Text style={styles.text}>Shares: {item.requestedShares}</Text>
            <Text style={styles.text}>Step: {item.stepNumber}</Text>
            <Text style={styles.text}>Status: {item.status ?? 'Pending'}</Text>
            <Text style={styles.text}>Priority: {item.isPriority ? 'Yes' : 'No'}</Text>
            {item.approvedAmount && (
              <Text style={styles.text}>Approved: ${item.approvedAmount} / {item.approvedShares} shares</Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5dc' },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#2a1602' },
  card: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  text: { fontSize: 16, marginBottom: 4 },
});
