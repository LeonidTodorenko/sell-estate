import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, Image, TouchableOpacity,Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useLoading } from '../contexts/LoadingContext';
import Swiper from 'react-native-swiper';
import Modal from 'react-native-modal';

interface Investment {
  propertyId: string;
  propertyTitle: string;
  totalShares: number;
  totalInvested: number;
  ownershipPercent: number;
}

interface PropertyImage {
  id: string;
  base64Data: string;
}

const InvestmentsScreen = () => {
  const { setLoading } = useLoading();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [imagesMap, setImagesMap] = useState<Record<string, PropertyImage[]>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const loadInvestments = useCallback(async () => {
    try {
      setLoading(true);
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return Alert.alert('Error', 'No user found');

      const user = JSON.parse(stored);
      const response = await api.get(`/investments/with-aggregated/${user.userId}`);
      setInvestments(response.data);

      const imagesResult: Record<string, PropertyImage[]> = {};
      for (const inv of response.data) {
        try {
          const res = await api.get(`/properties/${inv.propertyId}/images`);
          imagesResult[inv.propertyId] = res.data;
        } catch (err) {
          imagesResult[inv.propertyId] = [];
        }
      }
      setImagesMap(imagesResult);
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
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>🏠 {item.propertyTitle}</Text>
            <Text>💰 Invested: {item.totalInvested} USD</Text>
            <Text>📊 Shares: {item.totalShares}</Text>
            <Text>📈 Ownership: {item.ownershipPercent}%</Text>
            {imagesMap[item.propertyId] && imagesMap[item.propertyId].length > 0 && (
              <View style={styles.carouselContainer}>
                <Swiper
                  style={styles.swiper}
                  height={180}
                  showsPagination={true}
                  loop={false}
                  onIndexChanged={(index) => setImageIndex(index)}
                >
                  {imagesMap[item.propertyId].map((image) => (
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
                  {imageIndex + 1}/{imagesMap[item.propertyId].length}
                </Text>
              </View>
            )}
             <Button title="📄 View Payment Plan" onPress={() => navigation.navigate('PaymentPlan', { propertyId: item.propertyId, readonly: true })} />
               <View style={{ height: 10 }} />
            <Text
              style={styles.link}
              onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.propertyId })}
            >
              ➕ View Property
            </Text>
          </View>
        )}
      />

      <Modal isVisible={modalVisible} onBackdropPress={() => setModalVisible(false)}>
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
  carouselContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  carouselImage: {
    width: 320,
    height: 180,
    borderRadius: 6,
  },
  carouselText: {
    marginTop: 4,
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
});

export default InvestmentsScreen;
