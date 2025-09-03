import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';
import Swiper from 'react-native-swiper';
import { TouchableOpacity, Modal } from 'react-native';
import theme from '../constants/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PropertyDetail'>;

interface PropertyImage {
  id: string;
  base64Data: string;
}


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
  expectedCompletionDate?: string;
  images?: PropertyImage[];
}

const PropertyDetailScreen = ({ route }: Props) => {
  const { propertyId } = route.params;
  const [property, setProperty] = useState<Property | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
const [modalImage, setModalImage] = useState<string | null>(null);
const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/properties`);
        const found = res.data.find((p: Property) => p.id === propertyId);
        if (!found) throw new Error('Not found');
        const imgRes = await api.get(`/properties/${propertyId}/images`);
        found.images = imgRes.data;
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
      {property.images && property.images.length > 0 && (
        <View style={styles.carouselContainer}>
          <Swiper
            style={styles.swiper}
            height={200}
            showsPagination={true}
            loop={false}
            onIndexChanged={(index) => setImageIndex(index)}
          >
            {property.images.map((image) => (
              <TouchableOpacity
                key={image.id}
                onPress={() => {
                  setModalImage(image.base64Data);
                  setModalVisible(true);
                }}
              >
                <Image source={{ uri: image.base64Data }} style={styles.carouselImage} />
              </TouchableOpacity>
            ))}
          </Swiper>
          <Text style={styles.carouselText}>
            {imageIndex + 1}/{property.images.length}
          </Text>
        </View>
      )}

      <Text style={styles.title}>{property.title}</Text>
      <Text>📍 {property.location}</Text>
      <Text>💰 Price: {property.price} USD</Text>
      <Text>📊 Shares: {property.availableShares} / {property.totalShares}</Text>
      <Text>Status: {property.status}</Text>
      <Text>💸 Monthly Income: {property.monthlyRentalIncome} USD</Text>
      <Text>📅 Expected completion date: {new Date(property.expectedCompletionDate!).toLocaleDateString()}</Text>
       <Modal visible={modalVisible} transparent={true} onRequestClose={() => setModalVisible(false)}>
              <View style={styles.modalView}>
                {modalImage && (
                  <Image source={{ uri: modalImage }} style={styles.modalImage} />
                )}
              </View>
            </Modal>
    </ScrollView>
    

    
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 ,backgroundColor: theme.colors.background},
  image: { width: '100%', height: 200, borderRadius: 8, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  carouselContainer: {
  alignItems: 'center',
  marginBottom: 16,
},
carouselImage: {
  width: '100%',
  height: 200,
  borderRadius: 8,
},
carouselText: {
  textAlign: 'center',
  marginTop: 4,
},
swiper: {
  height: 200,
},
modalView: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.8)',
  justifyContent: 'center',
  alignItems: 'center',
},
modalImage: {
  width: '90%',
  height: '70%',
  resizeMode: 'contain',
},

});

export default PropertyDetailScreen;
