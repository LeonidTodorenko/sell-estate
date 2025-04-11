import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, Button } from 'react-native';
import api from '../api';

interface Investment {
  investmentId: string;
  userId: string;
  userName: string;
  propertyName: string;
  shares: number;
  investedAmount: number;
  createdAt: string;
}

const AdminInvestmentsScreen = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);

  const loadData = async () => {
    try {
      const res = await api.get('/investments/all');
      setInvestments(res.data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load investments');
    }
  };

  const handleDelete = (investmentId: string) => {
    Alert.alert('Cancel Investment', 'Are you sure you want to cancel this investment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/investments/${investmentId}`);
            Alert.alert('Success', 'Investment cancelled');
            loadData();
          } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to cancel investment');
          }
        },
      },
    ]);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All Investments</Text>
      <FlatList
        data={investments}
        keyExtractor={(item) => item.investmentId}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>User: {item.userName}</Text>
            <Text>Property: {item.propertyName}</Text>
            <Text>Shares: {item.shares}</Text>
            <Text>Invested: {item.investedAmount} USD</Text>
            <Text>Date: {new Date(item.createdAt).toLocaleDateString()}</Text>
            <Button title="Cancel" color="red" onPress={() => handleDelete(item.investmentId)} />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
  },
});

export default AdminInvestmentsScreen;
