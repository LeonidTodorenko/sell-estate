import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'PropertyDetail'>;

interface Property {
  id: string;
  title: string;
  location: string;
  price: number;
  totalShares: number;
  availableShares: number;
  status: string;
  imageBase64?: string;
  monthlyRentalIncome?: number;
  createdAt?: string;
}

const PropertyDetailScreen = ({ route }: Props) => {
  const { propertyId } = route.params;
  const [property, setProperty] = useState<Property | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/properties`);
        const found = res.data.find((p: Property) => p.id === propertyId);
        if (!found) throw new Error('Not found');
        setProperty(found);
      } catch (err) {
        Alert.alert('Error', 'Failed to load property');
      }
    };

    load();
  }, [propertyId]);

  if (!property) return <View><Text>Loading...</Text></View>;

  return (
    <ScrollView style={styles.container}>
      {property.imageBase64 && (
        <Image
          source={{ uri: property.imageBase64 }}
          style={styles.image}
          resizeMode="cover"
        />
      )}
      <Text style={styles.title}>{property.title}</Text>
      <Text>📍 {property.location}</Text>
      <Text>💰 Price: {property.price} USD</Text>
      <Text>📊 Shares: {property.availableShares} / {property.totalShares}</Text>
      <Text>Status: {property.status}</Text>
      <Text>💸 Monthly Income: {property.monthlyRentalIncome} USD</Text>
      <Text>📅 Listed on: {new Date(property.createdAt!).toLocaleDateString()}</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  image: { width: '100%', height: 200, borderRadius: 8, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
});

export default PropertyDetailScreen;
