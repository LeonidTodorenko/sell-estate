import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, Alert, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';
import { launchImageLibrary } from 'react-native-image-picker';
import Swiper from 'react-native-swiper';
import Modal from 'react-native-modal';
//import PaymentPlanScreen from '../components/PaymentPlanScreen';

global.Buffer = global.Buffer || require('buffer').Buffer;

interface PropertyImage {
  id: string;
  base64Data: string;
}

interface PropertyStats {
  applicationCount: number;
  totalRequested: number;
  totalApprovedShares: number;
}

interface Property {
  id: string;
  title: string;
  location: string;
  price: number;
  realPrice : number;
  totalShares: number;
  availableShares: number;
  status: string;
  listingType: string;
  latitude: number;
  longitude: number;
  expectedCompletionDate: Date;
  upfrontPayment: number;
  applicationDeadline: string;
  priorityInvestorId?: string;
  monthlyRentalIncome: number;
  buybackPricePerShare: number;
  lastPayoutDate: string;
  images: PropertyImage[];
  stats?: PropertyStats;
}

interface UserMap {
  [key: string]: string;
}

const AdminPropertiesScreen = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [userMap, setUserMap] = useState<UserMap>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const loadProperties = async () => {
    try {
      const userResponses = await api.get('/properties/with-stats');
      const propertiesWithImages = await Promise.all(userResponses.data.map(async (p: Property) => {
        const imgRes = await api.get(`/properties/${p.id}/images`);
        return { ...p, images: imgRes.data };
      }));
      setProperties(propertiesWithImages);

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
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.7, includeBase64: true });
    if (result.didCancel || !result.assets?.length)  { return; };

    const asset = result.assets[0];
    const type = asset.type || 'image/jpeg';

    if (!asset.base64)  { return; };
    const base64Data = `data:${type};base64,${asset.base64}`;

    try {
      await api.post(`/properties/${propertyId}/images`, { base64Image: base64Data });
      Alert.alert('Success', 'Image uploaded');
      loadProperties();
    } catch (err) {
        console.error(err);
      Alert.alert('Error', 'Image upload failed');
    }
  };

  const deleteImage = async (imageId: string) => {
    try {
      await api.delete(`/properties/images/${imageId}`);
      Alert.alert('Deleted', 'Image removed');
      loadProperties();
    } catch (err) {
      Alert.alert('Error', 'Failed to delete image');
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

  const changeListingType = async (id: string, newType: string) => {
    try {
      await api.post(`/properties/${id}/change-listing-type`, JSON.stringify(newType), {
        headers: { 'Content-Type': 'application/json' },
      });
      await loadProperties();
    } catch (err) {
      Alert.alert('Error', 'Failed to change listing type');
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
          {item.realPrice && (
           <Text>💰 Real price: {item.realPrice} USD</Text>
           )}
          <Text>📊 {item.availableShares}/{item.totalShares} Shares</Text>
          <Text>💵 Upfront Payment: {item.upfrontPayment}</Text>
          <Text>🗓 Deadline: {new Date(item.applicationDeadline).toLocaleDateString()}</Text>
          <Text>📈 Monthly Rent: {item.monthlyRentalIncome}</Text>
          <Text>📤 Last Payout: {new Date(item.lastPayoutDate).toLocaleDateString()}</Text>
          {item.priorityInvestorId && (
            <Text>⭐ Priority Investor: {userMap[item.priorityInvestorId] || item.priorityInvestorId}</Text>
          )}
          <Text>Type: {item.listingType === 'sale' ? 'For Sale' : 'For Rent'}</Text>
          <Text>Status: {item.status}</Text>
          <Text>🏗 Completion Date: {new Date(item.expectedCompletionDate).toLocaleDateString()}</Text>
          {item.buybackPricePerShare && (
            <Text>Buy back price per share: {item.buybackPricePerShare}</Text>
          )}
          {item.stats && (
            <View>
              <Text>📥 Applications: {item.stats.applicationCount}</Text>
              <Text>💸 Requested: {item.stats.totalRequested.toFixed(2)} USD</Text>
              <Text>✅ Approved Shares: {item.stats.totalApprovedShares}</Text>
            </View>
          )}

          {/* Карусель */}
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

          <Button title="📄 View Payment Plan" onPress={() => navigation.navigate('PaymentPlan', { propertyId: item.id, readonly: false })} />

          <View style={styles.buttonRow}>
            <Button title="📍 View on Map" onPress={() => {
              if (typeof item.latitude === 'number' && typeof item.longitude === 'number') {
                navigation.navigate('PropertyMap', {
                  latitude: item.latitude,
                  longitude: item.longitude,
                  title: item.title,
                });
              } else {
                Alert.alert('Error', 'Invalid coordinates');
              }
            }} />

            <Button title="📷 Upload Image" onPress={() => uploadImage(item.id)} />

            {item.images && item.images.length > 0 && (
              <Button title="🗑 Delete Image" color="red" onPress={() => deleteImage(item.images[imageIndex].id)} />
            )}

            <Button
              title={item.listingType === 'sale' ? 'Set For Rent' : 'Set For Sale'}
              onPress={() => changeListingType(item.id, item.listingType === 'sale' ? 'rent' : 'sale')}
            />

            <Button title="Set Sold" onPress={() => changeStatus(item.id, 'sold')} />
            <Button title="Set Available" onPress={() => changeStatus(item.id, 'available')} />
            <Button title="✏️ Edit" onPress={() => navigation.navigate('PropertyForm', { property: item })} />
            <Button title="🗑 Delete" color="red" onPress={() => {
              Alert.alert('Confirm Deletion', 'Are you sure you want to delete this property?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                      await api.delete(`/properties/${item.id}`);
                      Alert.alert('Deleted', 'Property has been removed');
                      loadProperties();
                    } catch (err) {
                      Alert.alert('Error', 'Failed to delete property');
                    }
                  },
                },
              ]);
            }} />

            {item.status === 'available' && (
              <Button title="✅ Finalize Auction" onPress={() => handleFinalize(item.id)} color="green" />
            )}
          </View>
        </View>
      ))}

      <Modal isVisible={modalVisible} onBackdropPress={() => setModalVisible(false)}>
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
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
  },
  swiper: {
    height: 180,
  },
  modalView: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
  },
  buttonRow: {
    marginTop: 10,
    flexDirection: 'column',
    gap: 5,
  },
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
});

export default AdminPropertiesScreen;
