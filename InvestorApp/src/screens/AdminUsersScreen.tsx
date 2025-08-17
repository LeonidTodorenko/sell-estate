import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { View, Text, FlatList,   StyleSheet, Alert } from 'react-native';
import api from '../api';
import BlueButton from '../components/BlueButton';

interface User {
  id: string;
  fullName: string;
  email: string;
  walletBalance: number;
  isBlocked: boolean;
}

const AdminUsersScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [users, setUsers] = useState<User[]>([]);

  const loadUsers = async () => {
    try {
      const res = await api.get('/users/all');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load users');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleBlock = async (userId: string) => {
    try {
      await api.post(`/users/${userId}/block`);
      loadUsers();
    } catch (err) {
      Alert.alert('Error', 'Failed to update user status');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Users</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>Name: {item.fullName}</Text>
            <Text>Email: {item.email}</Text>
            <Text>Balance: {item.walletBalance} USD</Text>
            <Text>Status: {item.isBlocked ? 'Blocked' : 'Active'}</Text>
          <BlueButton 
              title="➕ Upload KYC"
              onPress={() => navigation.navigate('AdminKycUpload', { userId: item.id })}
            />
         <BlueButton 
              title="📄 View KYC"
              onPress={() => navigation.navigate('UserKycView', { userId: item.id })}
            />
    <BlueButton 
              title={item.isBlocked ? 'Unblock' : 'Block'}
              onPress={() => toggleBlock(item.id)}
              variant={item.isBlocked ? 'green' : 'red'}
            />
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

export default AdminUsersScreen;
