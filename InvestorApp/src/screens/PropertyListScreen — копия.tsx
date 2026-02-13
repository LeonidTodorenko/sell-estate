import React, {  useMemo, useRef,useState } from 'react';
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

import theme from '../constants/theme';
//import { Linking } from 'react-native';
import WebView from 'react-native-webview';

import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import InvestButton from '../components/InvestButton';


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
   media?: PropertyMedia[];
  priorityInvestorId?: string;
  hasPaymentPlan?: boolean;
  expectedCompletionDate?: string | null;
    videoUrl?: string | null;
}

interface UserMap {
  [key: string]: string;
}

type Slide =
  | { kind: 'image'; id: string; uri: string }
  | { kind: 'video'; id: string; uri: string };

 

type MediaType = 'image' | 'video';


interface PropertyMedia {
  id: string;
  type: MediaType;    
  url?: string | null;   
  base64Data?: string | null;  
}

 
type PropertyCardProps = {
  item: Property;
  navigation: NativeStackNavigationProp<RootStackParamList>;
  userMap: UserMap;
  openImage: (uri: string) => void;
  openVideo: (url: string) => void;
};

type ApiMedia = {
  id: string;
  type: number;               
  url?: string | null;
  base64Data?: string | null;
};

const PropertyCard: React.FC<PropertyCardProps> = ({ item, navigation, userMap, openImage, openVideo }) => {
  const swiperRef = useRef<Swiper>(null);
  const [index, setIndex] = useState(0);

  const slides: Slide[] = useMemo(() => {
    const fromImages: Slide[] = (item.images ?? [])
      .filter(img => !!img.base64Data)
      .map(img => ({ kind: 'image' as const, id: img.id, uri: img.base64Data }));

    const fromMedia: Slide[] = (item.media ?? [])
      .map(m => {
        const uri = (m.base64Data ?? m.url ?? '')?.trim();
        if (!uri) return null;

        const isVideo = m.type === 'video';
        return {
          kind: (isVideo ? 'video' : 'image') ,
          id: m.id,
          uri,
        };
      })
          .filter((x): x is Slide => x !== null);

    // Легаси: если в item.videoUrl лежит ютуб — добавим как отдельный видео-слайд
    const legacyVideo: Slide[] = item.videoUrl
      ? [{ kind: 'video' as const, id: `legacy-video-${item.id}`, uri: item.videoUrl }]
      : [];

    return [...fromImages, ...fromMedia, ...legacyVideo].filter(s => !!s.uri);
  }, [item.images, item.media, item.videoUrl, item.id]);

  const total = slides.length;

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.title}</Text>

      {total > 0 && (
        <View style={styles.carouselContainer}>
          <Swiper
            ref={swiperRef}
            style={styles.swiper}
            height={180}
            showsPagination
            loop={false}
            onIndexChanged={setIndex}
          >
            {slides.map((s) => (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.9}
                onPress={() => {
                  if (s.kind === 'image') {
                    openImage(s.uri);
                  } else {
                    let url = s.uri;

                    // shorts -> watch?v= (твоя текущая логика)
                    if (url.includes('youtube.com/shorts')) {
                      const id = url.split('/shorts/')[1]?.split('?')[0];
                      if (id) url = `https://www.youtube.com/watch?v=${id}`;
                    }

                    openVideo(url);
                  }
                }}
              >
                {s.kind === 'image' ? (
                  <Image source={{ uri: s.uri }} style={styles.carouselContainerImage} />
                ) : (
                  <View style={[styles.carouselContainerImage, styles.videoSlide]}>
                    <Text style={styles.videoSlideText}>▶ Play video</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </Swiper>

          <Text style={styles.carouselContainerText}>
            {Math.min(index + 1, total)}/{total}
          </Text>

          {/* стрелки под галереей */}
          {total > 1 && (
            <View style={styles.galleryArrows}>
              <TouchableOpacity
                onPress={() => swiperRef.current?.scrollBy(-1, true)}
                disabled={index === 0}
                style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}
              >
                <Text style={styles.arrowTxt}>‹ Prev</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => swiperRef.current?.scrollBy(1, true)}
                disabled={index === total - 1}
                style={[styles.arrowBtn, index === total - 1 && styles.arrowBtnDisabled]}
              >
                <Text style={styles.arrowTxt}>Next ›</Text>
              </TouchableOpacity>
            </View>
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
        <Text>Type: {item.listingType === 'sale' ? 'For Sale' : 'For Rent'}</Text>
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

      <View style={{ height: 10 }} />

      <InvestButton
        title={item.hasPaymentPlan ? 'Invest' : 'Object not active'}
        disabled={!item.hasPaymentPlan}
        onPress={() =>
          navigation.navigate('BuyShares', {
            propertyId: item.id,
            propertyName: item.title,
          })
        }
      />

      <View style={{ height: 10 }} />
    </View>
  );
};


const PropertyListScreen = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [userMap, setUserMap] = useState<UserMap>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  //const [imageIndex, setImageIndex] = useState(0);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [videoModalVisible, setVideoModalVisible] = useState(false);
const [videoUrl, setVideoUrl] = useState<string | null>(null);

const openImage = (uri: string) => {
  setModalImage(uri);
  setModalVisible(true);
};

const openVideo = (url: string) => {
  setVideoUrl(url);
  setVideoModalVisible(true);
};
 

useFocusEffect(
  useCallback(() => {
    const loadProperties = async () => {
      try {
        const res = await api.get('/properties');
        
        const propertiesWithExtras = await Promise.all(
          res.data.map(async (p: Property) => {
            // const [imgRes, paymentPlanRes] = await Promise.all([
            //   api.get(`/properties/${p.id}/images`),
            //   api.get(`/properties/${p.id}/payment-plans`),
            // ]);
            const [imgRes, mediaRes, paymentPlanRes] = await Promise.all([
              api.get(`/properties/${p.id}/images`),      
              api.get(`/properties/${p.id}/media`),        
              api.get(`/properties/${p.id}/payment-plans`),
            ]);
            const normalizedMedia: PropertyMedia[] = (mediaRes.data ?? []).map((m: ApiMedia) => ({
              id: m.id,
              type: m.type === 2 ? 'video' : 'image',
              url: m.url ?? null,
              base64Data: m.base64Data ?? null,
             }));
        
            return {
              ...p,
              images: imgRes.data,
              media: normalizedMedia,
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
  <PropertyCard
    item={item}
    navigation={navigation}
    userMap={userMap}
    openImage={openImage}
    openVideo={openVideo}
  />
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
  justifyContent: 'space-between',
   width: '100%', 
  //gap: 12, 
  marginTop: 6,
  marginBottom: 8,
  paddingHorizontal: 32,
},
linkItem: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,   
},
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

videoSlide: {
  backgroundColor: '#000',
  justifyContent: 'center',
  alignItems: 'center',
},
videoSlideText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '800',
},
galleryArrows: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  width: 320,
  marginTop: 6,
},
arrowBtn: {
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderRadius: 10,
  backgroundColor: 'rgba(0,0,0,0.08)',
},
arrowBtnDisabled: {
  opacity: 0.35,
},
arrowTxt: {
  fontWeight: '800',
  color: '#2a1602',
},


});

export default PropertyListScreen;
