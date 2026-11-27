import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';
import Swiper from 'react-native-swiper';
import { TouchableOpacity, Modal } from 'react-native';
import { PropertyAIInsights } from '../components/NativeInvestmentInsights';
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
  about?: string;
  imageBase64?: string;
  monthlyRentalIncome?: number;
  expectedCompletionDate?: string;
  images?: PropertyImage[];
}

const PropertyDetailScreen = ({ route, navigation }: Props) => {
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

  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  const completion = Date.parse(property.expectedCompletionDate ?? '');
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>{property.title}</Text>
      {!!property.location && <Text style={styles.copy}>{property.location}</Text>}
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

      <View style={styles.summary}>
        <Text accessibilityRole="header" style={styles.heading}>Property overview</Text>
        <View style={styles.row}><Text style={styles.copy}>Property price</Text><Text style={styles.value}>{money(property.price)}</Text></View>
        <View style={styles.row}><Text style={styles.copy}>Available shares</Text><Text style={styles.value}>{property.availableShares} / {property.totalShares}</Text></View>
        {!!property.status && <View style={styles.row}><Text style={styles.copy}>Status</Text><Text style={styles.value}>{property.status}</Text></View>}
        {typeof property.monthlyRentalIncome === 'number' && <View style={styles.row}><Text style={styles.copy}>Configured monthly rent</Text>
          <Text style={styles.value}>{money(property.monthlyRentalIncome)}</Text></View>}
        {Number.isFinite(completion) && <View style={styles.row}><Text style={styles.copy}>Expected completion</Text>
          <Text style={styles.value}>{new Date(completion).toLocaleDateString()}</Text></View>}
        {!!property.about && <Text style={styles.copy}>{property.about}</Text>}
      </View>
      <PropertyAIInsights key={propertyId} id={propertyId} onOpenAssistant={() =>
        navigation.navigate('Assistant', { propertyId, question: `Show a forecast for ${property.title}` })}/>
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
  content: { gap: 10, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '700', color: theme.colors.text },
  heading: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  summary: { backgroundColor: theme.colors.surface, padding: 16, borderRadius: 16, gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  copy: { color: theme.colors.textSecondary },
  value: { color: theme.colors.text, fontWeight: '600' },
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
