import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList, StyleSheet, Alert } from 'react-native';
import api from '../api';

interface User {
  id: string;
  fullName: string;
  email: string;
  kycStatus: string;
}

const AdminKycScreen = () => {
  const [users, setUsers] = useState<User[]>([]);

  const loadKycUsers = async () => {
    try {
      const res = await api.get('/users/kyc/pending');
      setUsers(res.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load users');
    }
  };

  useEffect(() => {
    loadKycUsers();
  }, []);

  const handleAction = async (userId: string, action: 'verify' | 'reject') => {
    try {
      await api.post(`/users/${userId}/kyc/${action}`);
      loadKycUsers();
    } catch (err) {
      Alert.alert('Error', 'Failed to update KYC status');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>KYC Requests</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>Name: {item.fullName}</Text>
            <Text>Email: {item.email}</Text>
            <Text>Status: {item.kycStatus}</Text>

            <View style={styles.buttonRow}>
              <Button title="Verify" onPress={() => handleAction(item.id, 'verify')} />
              <Button title="Reject" color="red" onPress={() => handleAction(item.id, 'reject')} />
            </View>
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
});

export default AdminKycScreen;
