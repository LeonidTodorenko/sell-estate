import React, {  useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import Swiper from 'react-native-swiper';
import api from '../api';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';
//import { Linking } from 'react-native';
import WebView from 'react-native-webview';

import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';


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
  expectedCompletionDate?: string | null;
    videoUrl?: string | null;
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
  const [videoModalVisible, setVideoModalVisible] = useState(false);
const [videoUrl, setVideoUrl] = useState<string | null>(null);
 

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

          const sortedProperties = propertiesWithExtras.sort((a, b) =>
              a.title.localeCompare(b.title)
            );

        setProperties(sortedProperties);

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


            {/* {item.images && item.images.length > 0 && (
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
            )} */}
          <Text style={styles.name}>{item.title}</Text>
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
                      <Image
                        source={{ uri: image.base64Data }}
                        style={styles.carouselContainerImage}
                      />
                    </TouchableOpacity>
                  ))}
                </Swiper>

                {/* Индекс слайдов */}
                <Text style={styles.carouselContainerText}>
                  {imageIndex + 1}/{item.images.length}
                </Text>

                {/* Ярлык для видео — только если ссылка есть */}
                {item.videoUrl && (
             <TouchableOpacity
                    style={styles.videoBadge}
                    onPress={() => {
                      // Конвертируем YouTube shorts → нормальное watch?v= format
                      let url = item.videoUrl!;
                      if (url.includes("youtube.com/shorts")) {
                        const id = url.split("/shorts/")[1].split("?")[0];
                        url = `https://www.youtube.com/watch?v=${id}`;
                      }

                      setVideoUrl(url);
                      setVideoModalVisible(true);
                    }}
                  >
                    <Text style={styles.videoBadgeText}>▶ Video</Text>
                  </TouchableOpacity>

                )}
              </View>
             )}
{/* Links under carousel */}
<View style={styles.linksRow}>
  <TouchableOpacity
    onPress={() =>
      navigation.navigate('PropertyMap', {
        latitude: item.latitude,
        longitude: item.longitude,
        title: item.title,
      })
    }
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  >
    
    <View style={styles.linkItem}>
    <Ionicons name="location-sharp" size={16} color={theme.colors.primary} />
    <Text style={styles.linkText}>Location</Text>
  </View>
  </TouchableOpacity>

  <Text style={styles.linkSeparator}>•</Text>

  <TouchableOpacity
    onPress={() => navigation.navigate('PaymentPlan', { propertyId: item.id, readonly: true })}
    disabled={!item.hasPaymentPlan}
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  >
   
    <View style={styles.linkItem}>
    <MaterialCommunityIcons name="cash-multiple" size={16} color={theme.colors.primary} />
    <Text style={[styles.linkText, !item.hasPaymentPlan && styles.linkDisabled]}>
      Payment plan
    </Text>
  </View>
  </TouchableOpacity>
</View>



            
            <Text>Location: {item.location}</Text>
            <Text>Price: {item.price} USD</Text>
            <View style={styles.row}>
              <Text >Type: {item.listingType === 'sale' ? 'For Sale' : 'For Rent'}</Text>
           
            </View>
            <View style={styles.row}>
              {!!item.expectedCompletionDate && (
                            <Text style={styles.rightNote}>
                             Estimated completion: {new Date(item.expectedCompletionDate).toLocaleDateString()}
                            </Text>
                          )}
              </View>
            <Text>Available Shares: {item.availableShares}</Text>
            {item.priorityInvestorId && (
              <Text>⭐ Priority Investor: {userMap[item.priorityInvestorId] || item.priorityInvestorId}</Text>
            )}
            {/* <BlueButton
            icon="📍"
              title="Location"
              onPress={() =>
                navigation.navigate('PropertyMap', {
                  latitude: item.latitude,
                  longitude: item.longitude,
                  title: item.title,
                })
              }
            />
            <View style={{ height: 10 }} />
            <BlueButton icon="📄" title=" View Payment Plan" onPress={() => navigation.navigate('PaymentPlan', { propertyId: item.id, readonly: true })} />

            <View style={{ height: 10 }} /> */}
   <View style={{ height: 10 }} />
            <BlueButton icon="💸"
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
      <Modal
        visible={videoModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setVideoModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <TouchableOpacity
            onPress={() => setVideoModalVisible(false)}
            style={{ padding: 12, backgroundColor: '#222' }}
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>✖ Close</Text>
          </TouchableOpacity>

          {videoUrl && (
            <WebView
              source={{ uri: videoUrl }}
              style={{ flex: 1 }}
              allowsFullscreenVideo
              javaScriptEnabled
              domStorageEnabled
            />
          )}
        </View>
      </Modal>

    </View>
    
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 ,backgroundColor: theme.colors.background},
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, display: 'none'  },
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
    marginVertical: 1,
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
   row: {
    flexDirection: 'row',
    //justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,                // RN 0.71+, иначе можно убрать
  //  marginTop: 4,
  },
  rightNote: {
    textAlign: 'left',
    maxWidth: '70%',
  },
    
  videoBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  videoBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
linksRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12, // если RN старый — замени на marginRight у элементов
  marginTop: 6,
  marginBottom: 8,
},
linkItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
linkText: {
 // color: theme.colors.primary, // или '#007bff'
  fontSize: 14,
  fontWeight: '600',
   fontFamily: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
  }),
},

linkSeparator: {
  color: '#999',
  fontSize: 14,
},

linkDisabled: {
  color: '#aaa',
  textDecorationLine: 'none',
},

});

export default PropertyListScreen;
