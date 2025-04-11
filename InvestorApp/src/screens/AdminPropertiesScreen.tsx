import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Button, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';
import { Image } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Buffer } from 'buffer';

global.Buffer = global.Buffer || require('buffer').Buffer;

interface Property {
  id: string;
  title: string;
  location: string;
  price: number;
  totalShares: number;
  availableShares: number;
  status: string;
  listingType: string;
  imageBase64?: string;
  latitude: number;
  longitude: number;
  expectedCompletionDate: Date;
  upfrontPayment: number;
  applicationDeadline: string;
  priorityInvestorId?: string;
  monthlyRentalIncome: number;
  lastPayoutDate: string;
}

interface UserMap {
  [key: string]: string;
}

const AdminPropertiesScreen = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [userMap, setUserMap] = useState<UserMap>({});
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const loadProperties = async () => {
    try {
      const res = await api.get('/properties');
      setProperties(res.data);

      const userIds = res.data
        .filter((p: Property) => p.priorityInvestorId)
        .map((p: Property) => p.priorityInvestorId);

      const uniqueIds = [...new Set(userIds)];
      const map: UserMap = {};

      if (uniqueIds.length > 0) {
        const usersRes = await Promise.all(
          uniqueIds.map((id) => api.get(`/users/${id}`))
        );
      
        usersRes.forEach((res) => {
          const user = res.data;
          map[user.id] = user.fullName;
        });
      }
      
      // const usersRes = await Promise.all(
      //   uniqueIds.map((id) => api.get(`/users/${id}`))
      // );

      // const map: UserMap = {};
      // usersRes.forEach((res) => {
      //   const user = res.data;
      //   map[user.id] = user.fullName;
      // });

      setUserMap(map);

    } catch (error: any) {
      console.error('Axios Error:', error);
    
      let details = '';
    
      if (error.response) {
        details += `Status: ${error.response.status}\n`;
        details += `Status Text: ${error.response.statusText}\n`;
        if (error.response.data) {
          details += `Server Response: ${JSON.stringify(error.response.data)}\n`;
        }
      } else if (error.request) {
        details += 'Request made but no response received\n';
        details += JSON.stringify(error.request);
      } else {
        details += `Error Message: ${error.message}\n`;
      }
    
      details += `\nRequest Config:\n${JSON.stringify(error.config, null, 2)}`;
    
      Alert.alert('Request Failed', details.slice(0, 1000));  
    }
  };

  const uploadImage = async (propertyId: string) => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.7 });
    if (result.didCancel || !result.assets?.length) return; // todo check  if (result.didCancel || !result.assets || !result.assets.length) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const type = asset.type || 'image/jpeg';

    try {
      const response = await fetch(uri!);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const base64Data = `data:${type};base64,${base64}`;

      await api.post(`/properties/${propertyId}/upload-image`, {
        base64Image: base64Data,
      });

      Alert.alert('Success', 'Image uploaded');
      loadProperties();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Image upload failed');
    }
  };

  const changeStatus = async (id: string, status: string) => {
    try {
      await api.post(`/properties/${id}/change-status`, status, {
        headers: { 'Content-Type': 'application/json' },
      });
      loadProperties();
    } catch (err) {
      Alert.alert('Error', 'Failed to change status');
    }
  };

  const handleFinalize = async (id: string) => {
    try {
      await api.post(`/investments/finalize/${id}`);
      Alert.alert('Success', 'Auction finalized');
      loadProperties();
    } catch (error: any) {
      let message = 'Failed to finalize auction ';
      console.error(error);
      if (error.response && error.response.data) {
        message = JSON.stringify(error.response.data);
      } else if (error.message) {
        message = error.message;
      }
      Alert.alert('Error', 'Failed to finalize auction ' + message);
    }
  };

  useEffect(() => {
    loadProperties();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Manage Properties</Text>
      <Button title="➕ Add Property" onPress={() => navigation.navigate('PropertyForm')} />
      {properties.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text>🏠 {item.title}</Text>
          <Text>📍 {item.location}</Text>
          <Text>💰 {item.price} USD</Text>
          <Text>📊 {item.availableShares}/{item.totalShares} Shares</Text>
          <Text>💵 Upfront Payment: {item.upfrontPayment}</Text>
          <Text>🗓 Deadline: {new Date(item.applicationDeadline).toLocaleDateString()}</Text>
          <Text>📈 Monthly Rent: {item.monthlyRentalIncome}</Text>
          <Text>📤 Last Payout: {new Date(item.lastPayoutDate).toLocaleDateString()}</Text>
          {item.priorityInvestorId && typeof item.priorityInvestorId === 'string' &&  (
            <Text>⭐ Priority Investor: {userMap[item.priorityInvestorId] || item.priorityInvestorId}</Text>
          )}
          <Text>Type: {item.listingType === 'sale' ? 'For Sale' : 'For Rent'}</Text>
          <Text>Status: {item.status}</Text>
          <Text>
            🏗 Completion Date: {new Date(item.expectedCompletionDate).toLocaleDateString()}
          </Text>
          {item.imageBase64 && (
            <View style={{ alignItems: 'center', marginVertical: 10 }}>
              <Image
                source={{ uri: item.imageBase64 }}
                style={{ width: 200, height: 120, borderRadius: 6 }}
              />
            </View>
          )}

 <View style={styles.buttonRow}>
          <Button
            title="📍 View on Map"
            onPress={() => {
              if (
                typeof item.latitude === 'number' &&
                typeof item.longitude === 'number' &&
                !isNaN(item.latitude) &&
                !isNaN(item.longitude)
              ) {
                navigation.navigate('PropertyMap', {
                  latitude: item.latitude,
                  longitude: item.longitude,
                  title: item.title,
                });
              } else {
                Alert.alert('Error', 'latitude or longitude corrupted');
              }
            }}
          />

      

          <Button title="📷 Upload Image" onPress={() => uploadImage(item.id)} />
 
            <Button title="Set Rented" onPress={() => changeStatus(item.id, 'rented')} />
            <Button title="Set Sold" onPress={() => changeStatus(item.id, 'sold')} />
            <Button title="Set Available" onPress={() => changeStatus(item.id, 'available')} />
            <Button title="✏️ Edit" onPress={() => navigation.navigate('PropertyForm', { property: item })} />
            {item.status === 'available' && (
              <Button title="✅ Finalize Auction" onPress={() => handleFinalize(item.id)} color="green" />
            )}
          </View>
        </View>
      ))}
    </ScrollView>
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
    marginTop: 10,
    flexDirection: 'column',
    gap: 5,
  },
});

export default AdminPropertiesScreen;
