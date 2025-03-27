import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Button, Alert } from 'react-native';
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
  imageBase64?: string;
}
 
const AdminPropertiesScreen = () => {
  const [properties, setProperties] = useState<Property[]>([]);

  const loadProperties = async () => {
    try {
      const res = await api.get('/properties');
      setProperties(res.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load properties');
    }
  };

  const uploadImage = async (propertyId: string) => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.7 });
  
    if (result.didCancel || !result.assets || !result.assets.length) return;
  
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

  useEffect(() => {
    loadProperties();
  }, []);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Properties</Text>
      <Button title="➕ Add Property" onPress={() => navigation.navigate('PropertyForm')} />
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>🏠 {item.title}</Text>
            <Text>📍 {item.location}</Text>
            <Text>💰 {item.price} USD</Text>
            <Text>📊 {item.availableShares}/{item.totalShares} Shares</Text>
            <Text>Status: {item.status}</Text>
             
            {item.imageBase64 && (
              <View style={{ alignItems: 'center', marginVertical: 10 }}>
                <Image
                  source={{ uri: item.imageBase64 }}
                  style={{ width: 200, height: 120, borderRadius: 6 }}
                />
              </View>
            )}
 
            <Button title="📷 Upload Image" onPress={() => uploadImage(item.id)} />

            <View style={styles.buttonRow}>
              <Button title="Set Rented" onPress={() => changeStatus(item.id, 'rented')} />
              <Button title="Set Sold" onPress={() => changeStatus(item.id, 'sold')} />
              <Button title="Set Available" onPress={() => changeStatus(item.id, 'available')} />
              <Button  title="✏️ Edit"  onPress={() => navigation.navigate('PropertyForm', { property: item })}
            />
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
    marginTop: 10,
    flexDirection: 'column',
    gap: 5,
  },
});

export default AdminPropertiesScreen;
