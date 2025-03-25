import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

interface PropertyInvestment {
  propertyId: string;
  propertyTitle: string;
  totalShares: number;
  totalInvested: number;
}

const MyPropertiesScreen = () => {
  const [properties, setProperties] = useState<PropertyInvestment[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;

      const user = JSON.parse(stored);
      const response = await api.get(`/investment/my-properties/${user.userId}`);
      setProperties(response.data);
    };

    loadData();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Properties</Text>
      <FlatList
        data={properties}
        keyExtractor={(item) => item.propertyId}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.propertyTitle}</Text>
            <Text>Total Shares: {item.totalShares}</Text>
            <Text>Total Invested: {item.totalInvested} USD</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No property investments yet.</Text>}
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
  name: { fontWeight: 'bold', fontSize: 16 },
});

export default MyPropertiesScreen;
