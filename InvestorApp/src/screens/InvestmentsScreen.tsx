import React, { useEffect, useState,useCallback  } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useLoading } from '../contexts/LoadingContext';

// interface Investment {
//   investmentId: string;
//   propertyId: string;
//   propertyTitle: string;
//   shares: number;
//   investedAmount: number;
//   createdAt: string;
//   percent: number;
// }

interface Investment {
  propertyId: string;
  propertyTitle: string;
  totalShares: number;
  totalInvested: number;
  ownershipPercent: number;
}
  
const InvestmentsScreen = () => {
  const { setLoading } = useLoading();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const loadInvestments = useCallback(async () => {
    try {
      setLoading(true);
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return Alert.alert('Error', 'No user found');

      const user = JSON.parse(stored);
      const response = await api.get(`/investments/with-aggregated/${user.userId}`);
      setInvestments(response.data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load investments');
    } finally {
      setLoading(false);
    }
  }, [setLoading]);
   
  useEffect(() => {
    loadInvestments();
  }, [loadInvestments]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Investments</Text>
      <FlatList
        data={investments}
        //keyExtractor={(item) => item.investmentId}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>🏠 {item.propertyTitle}</Text>
            <Text>💰 Invested: {item.totalInvested} USD</Text>
            <Text>📊 Shares: {item.totalShares}</Text>
            <Text>📈 Ownership: {item.ownershipPercent}%</Text>
            {/* <Text>📅 Date: {new Date(item.createdAt).toLocaleDateString()}</Text>  todo заменить на дату сдачи */}
            <Text
              style={styles.link}
              onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.propertyId })}
            >
              ➕ View Property
            </Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  name: { fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
  link: { color: 'blue', marginTop: 10 },
  card: {
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
});

export default InvestmentsScreen;
