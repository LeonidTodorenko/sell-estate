import React, { useEffect, useState } from 'react';
import { View, Text, FlatList,  StyleSheet, Alert } from 'react-native';
// import { useNavigation } from '@react-navigation/native';
// import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';
import BlueButton from '../components/BlueButton';

interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  status: string;
  createdAt: string;
}

const AdminWithdrawalsScreen = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  //const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>(); 

  const loadData = async () => {
    try {
      const response = await api.get('/withdrawals/all');
      setWithdrawals(response.data);
    } catch (error) {
      console.error('Error loading withdrawals', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api.post(`/withdrawals/${id}/${action}`);
      Alert.alert('Success', `Withdrawal ${action}ed`);
      loadData();
    } catch (error) {
      console.error('Error updating status', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All Withdrawal Requests</Text>
 
      {/* <BlueButton title="Manage Users" onPress={() => navigation.navigate('AdminUsers')} />

      <BlueButton title="View All Investments" onPress={() => navigation.navigate('AdminInvestments')} />

      <BlueButton title="Process KYC" onPress={() => navigation.navigate('AdminKyc')} />

      <BlueButton title="📊 View Stats" onPress={() => navigation.navigate('AdminStats')} />

      <BlueButton title="🏠 Manage Properties" onPress={() => navigation.navigate('AdminProperties')} /> */}


      <FlatList
        data={withdrawals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>User ID: {item.userId}</Text>
            <Text>Amount: {item.amount} USD</Text>
            <Text>Status: {item.status}</Text>
            <Text>Date: {new Date(item.createdAt).toLocaleDateString()}</Text>

            {item.status === 'pending' && (
              <View style={styles.buttonRow}>
                <BlueButton title="Approve" onPress={() => handleAction(item.id, 'approve')} />
                <BlueButton   title="Reject" variant="red" onPress={() => handleAction(item.id, 'reject')} />
              </View>
            )}
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

export default AdminWithdrawalsScreen;
