import React, {  useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Button,
  Image,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import Swiper from 'react-native-swiper';
import api from '../api';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

interface PropertyImage {
  id: string;
  base64Data: string;
}

interface Property {
  id: string;
  price: number;
  location: string;
  availableShares: number;
  listingType: string;
  latitude: number;
  longitude: number;
  title: string;
  images?: PropertyImage[];
  priorityInvestorId?: string;
  hasPaymentPlan?: boolean;
}

interface UserMap {
  [key: string]: string;
}

const PropertyListScreen = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [userMap, setUserMap] = useState<UserMap>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

useFocusEffect(
  useCallback(() => {
    const loadProperties = async () => {
      try {
        const res = await api.get('/properties');
        
        const propertiesWithExtras = await Promise.all(
          res.data.map(async (p: Property) => {
            const [imgRes, paymentPlanRes] = await Promise.all([
              api.get(`/properties/${p.id}/images`),
              api.get(`/properties/${p.id}/payment-plans`),
            ]);
            return {
              ...p,
              images: imgRes.data,
              hasPaymentPlan: paymentPlanRes.data && paymentPlanRes.data.length > 0,
            };
          })
        );
        setProperties(propertiesWithExtras);

        const userResponses = await api.get('/properties/with-stats');
        const userIds = userResponses.data.filter((p: Property) => p.priorityInvestorId).map((p: Property) => p.priorityInvestorId);
        const uniqueIds = [...new Set(userIds)];
        const map: UserMap = {};

        if (uniqueIds.length > 0) {
          const usersRes = await Promise.all(uniqueIds.map((id) => api.get(`/users/${id}`)));
          usersRes.forEach((res) => {
            const user = res.data;
            map[user.id] = user.fullName;
          });
        }

        setUserMap(map);
      }
       catch (error: any) {
                   let message = 'Failed to load properties ';
                        console.error(error);
                        if (error.response && error.response.data) {
                          message = JSON.stringify(error.response.data);
                        } else if (error.message) {
                          message = error.message;
                        }
                        Alert.alert('Error', 'Failed to load properties ' + message);
                      console.error(message);
                }
     
    };

    loadProperties();
  }, [])
);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Available Properties</Text>
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.images && item.images.length > 0 && (
              <View style={styles.carouselContainer}>
                <Swiper
                  style={styles.swiper}
                  height={180}
                  showsPagination={true}
                  loop={false}
                  onIndexChanged={(index) => setImageIndex(index)}
                >
                  {item.images.map((image) => (
                    <TouchableOpacity
                      key={image.id}
                      onPress={() => {
                        setModalImage(image.base64Data);
                        setModalVisible(true);
                      }}
                    >
                      <Image source={{ uri: image.base64Data }} style={styles.carouselContainerImage} />
                    </TouchableOpacity>
                  ))}
                </Swiper>
                <Text style={styles.carouselContainerText}>
                  {imageIndex + 1}/{item.images.length}
                </Text>
              </View>
            )}
            <Text style={styles.name}>{item.title}</Text>
            <Text>Location: {item.location}</Text>
            <Text>Price: {item.price} USD</Text>
            <Text>Type: {item.listingType === 'sale' ? 'For Sale' : 'For Rent'}</Text>
            <Text>Available Shares: {item.availableShares}</Text>
            {item.priorityInvestorId && (
              <Text>⭐ Priority Investor: {userMap[item.priorityInvestorId] || item.priorityInvestorId}</Text>
            )}
            <Button
              title="📍 View on Map"
              onPress={() =>
                navigation.navigate('PropertyMap', {
                  latitude: item.latitude,
                  longitude: item.longitude,
                  title: item.title,
                })
              }
            />
            <View style={{ height: 10 }} />
            <Button title="📄 View Payment Plan" onPress={() => navigation.navigate('PaymentPlan', { propertyId: item.id, readonly: true })} />
            <View style={{ height: 10 }} />
            <Button
              title={item.hasPaymentPlan ? "Invest" : "Object not active"}
              disabled={!item.hasPaymentPlan}
              onPress={() =>
                navigation.navigate('BuyShares', {
                  propertyId: item.id,
                  propertyName: item.title,
                })
              }
            />
            {/* {!item.hasPaymentPlan && (
              <Text style={{ color: 'red', marginTop: 5 }}>Object not active</Text>
            )} */}
            <View style={{ height: 10 }} />
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalView}>
          {modalImage && (
            <Image source={{ uri: modalImage }} style={styles.modalImage} />
          )}
        </View>
      </Modal>
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
  carouselContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  carouselContainerImage: {
    width: 320,
    height: 180,
    borderRadius: 6,
  },
  carouselContainerText: {
    marginTop: 4,
  },
  swiper: {
    height: 180,
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

export default PropertyListScreen;
