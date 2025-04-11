import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Button } from 'react-native';
import api from '../api';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

interface Property {
  id: string;
  price: number;
  location: string;
  availableShares: number;
  listingType: string;
  latitude: number;
  longitude: number;
  title: string;
}

const PropertyListScreen = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    const loadProperties = async () => {
      try {
        const response = await api.get('/properties');
        setProperties(response.data);
      } catch (error) {
        console.error('Failed to load properties', error);
      }
    };

    loadProperties();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Available Properties</Text>
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.title}</Text>
            <Text>Location: {item.location}</Text>
            <Text>Price: {item.price} USD</Text>
            <Text>Type: {item.listingType === 'sale' ? 'For Sale' : 'For Rent'}</Text>

            <Button
              title="📍 View on Map"
              onPress={() => navigation.navigate('PropertyMap', {
                latitude: item.latitude,
                longitude: item.longitude,
                title: item.title
              })}
            />

            <Text>Available Shares: {item.availableShares}</Text>
            <Button
              title="Invest"
              onPress={() =>
                navigation.navigate('BuyShares', {
                  propertyId: item.id,
                  propertyName: item.title,
                })
              }
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
  name: { fontWeight: 'bold', fontSize: 16 },
});

export default PropertyListScreen;
