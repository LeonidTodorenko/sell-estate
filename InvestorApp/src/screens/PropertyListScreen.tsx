import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

import Swiper from 'react-native-swiper';
import api from '../api';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import theme from '../constants/theme';

import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import InvestButton from '../components/InvestButton';
import Video from 'react-native-video';

import { fetchPropertiesWithExtras, Property } from '../services/properties';
import BlueButton from '../components/BlueButton';

import mapSampleImage from '../assets/images/map-sample.png';
import buttonMapImage from '../assets/images/button-map.png';
import paymentPlanImage from '../assets/images/paymentplan.png';

import { Linking } from 'react-native';

// interface PropertyImage {
//   id: string;
//   base64Data: string;
// }

// interface Property {
//   id: string;
//   price: number;
//   location: string;
//   availableShares: number;
//   listingType: string;
//   latitude: number;
//   longitude: number;
//   title: string;
//   images?: PropertyImage[];
//    media?: PropertyMedia[];
//   priorityInvestorId?: string;
//   hasPaymentPlan?: boolean;
//   expectedCompletionDate?: string | null;
//     videoUrl?: string | null;
// }

interface UserMap {
  [key: string]: string;
}

type Slide =
  | { kind: 'image'; id: string; uri: string }
  | { kind: 'video'; id: string; uri: string };

// type MediaType = 'image' | 'video';

// interface PropertyMedia {
//   id: string;
//   type: MediaType;
//   url?: string | null;
//   base64Data?: string | null;
// }

type PropertyCardProps = {
  item: Property;
  navigation: NativeStackNavigationProp<RootStackParamList>;
  userMap: UserMap;
  openImage: (uri: string) => void;
  openVideo: (url: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
};

// type ApiMedia = {
//   id: string;
//   type: number;
//   url?: string | null;
//   base64Data?: string | null;
// };

const PropertyCard: React.FC<PropertyCardProps> = ({
  item,
  navigation,
  userMap,
  openImage,
  openVideo,
  expanded,
  onToggleExpand,
}) => {
  const swiperRef = useRef<Swiper>(null);
  const [index, setIndex] = useState(0);

  const normalizeUrl = (u: string) =>
    u?.trim().replace(/^http:\/\//i, 'https://');

  const slides: Slide[] = useMemo(() => {
    const fromImages: Slide[] = (item.images ?? [])
      .filter((img) => !!img.base64Data)
      .map((img) => ({ kind: 'image' as const, id: img.id, uri: img.base64Data }));

    const fromMedia: Slide[] = (item.media ?? [])
      .map((m) => {
        const uriRaw = (m.base64Data ?? m.url ?? '')?.trim();
        const uri = uriRaw.startsWith('http') ? normalizeUrl(uriRaw) : uriRaw;
        // Alert.alert('URI', uri);
        if (!uri) return null;

        const typeString = String(m.type).toLowerCase();

        const isVideo =
          typeString === 'video' ||
          typeString === '2' ||
          /\.(mp4|mov|webm)(\?.*)?$/i.test(uri);

        return {
          kind: (isVideo ? 'video' : 'image') as 'video' | 'image',
          id: m.id,
          uri,
        };
      })
      .filter((x): x is Slide => x !== null);

    // Легаси: если в item.videoUrl лежит ютуб — добавим как отдельный видео-слайд
    // todo потом верну может
    // const legacyVideo: Slide[] = item.videoUrl
    //   ? [{ kind: 'video' as const, id: `legacy-video-${item.id}`, uri: item.videoUrl }]
    //   : [];

    return [...fromImages, ...fromMedia].filter((s) => !!s.uri);
  }, [item.images, item.media]);

  const total = slides.length;

  // function openVideo(uri: string) {
  //   throw new Error('Function not implemented.');
  // }

  const priceText = `$${Number(item.price ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const propertyStatusLabel = item.listingType === 'sale' ? 'For Sale' : 'For Rent';
  const statusDotColor = item.listingType === 'sale' ? '#10B981' : '#5B8DEF';

 const commissioningText = item.expectedCompletionDate
  ? new Date(item.expectedCompletionDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    })
  : 'Q2 2026';

const plannedSaleText = item.plannedSaleDate
  ? new Date(item.plannedSaleDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    })
  : 'Q4 2027';

  const yieldText =
  item.expectedYieldText?.trim() || '12-15% per annum (est.)';


  const aboutText =
  item.about?.trim() ||
  'Modern residential complex in a premium Dubai location. Spacious layouts, convenient transport access, and strong investment potential. A more detailed property description will be added later.';

  
  const presentationPdfUrl = item.presentationPdfUrl?.trim() || null;
const presentationPdfName = item.presentationPdfName?.trim() || 'Object Presentation';

  return (
    <View style={styles.card}>
      <View style={styles.mediaWrap}>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
          <Text style={[styles.statusBadgeText, { color: statusDotColor }]}>
            {propertyStatusLabel}
          </Text>
        </View>

        {total > 0 ? (
          <View style={styles.carouselContainer}>
            <Swiper
              ref={swiperRef}
              style={styles.swiper}
              height={220}
              showsPagination
              loop={false}
              dot={<View style={styles.swiperDot} />}
              activeDot={<View style={styles.swiperActiveDot} />}
              paginationStyle={styles.paginationStyle}
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
                      openVideo(normalizeUrl(s.uri));
                    }
                    // else {
                    //   let url = s.uri;

                    //   // shorts -> watch?v= (твоя текущая логика)
                    //   if (url.includes('youtube.com/shorts')) {
                    //     const id = url.split('/shorts/')[1]?.split('?')[0];
                    //     if (id) url = `https://www.youtube.com/watch?v=${id}`;
                    //   }

                    //   openVideo(url);
                    // }
                  }}
                >
                  {s.kind === 'image' ? (
                    <Image source={{ uri: s.uri }} style={styles.carouselContainerImage} />
                  ) : (
                    <View style={[styles.carouselContainerImage, styles.videoSlide]}>
                      {/* <Text style={styles.videoSlideText}>▶</Text> */}
                      <Text style={{ color: '#fff', marginTop: 6 }}>▶ Play video</Text>
                    </View>

                    // <View style={[styles.carouselContainerImage, styles.videoSlide]}>
                    //   <Text style={styles.videoSlideText}>▶ Play video</Text>
                    // </View>
                  )}
                </TouchableOpacity>
              ))}
            </Swiper>

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
        ) : (
          <View style={[styles.carouselContainerImage, styles.imageFallback]}>
            <Text style={styles.imageFallbackText}>No media</Text>
          </View>
        )}
      </View>

      <Text style={styles.price}>{priceText}</Text>

      <View style={styles.divider} />

      <TouchableOpacity activeOpacity={0.85} onPress={onToggleExpand} style={styles.headerBlock}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.name}>{item.title}</Text>
          <Text style={styles.location}>{item.location}</Text>

          <View style={styles.sharesRow}>
            <MaterialCommunityIcons
              name="ticket-confirmation-outline"
              size={16}
              color="#8E8E93"
            />
            <Text style={styles.sharesText}>{item.availableShares} shares available</Text>
          </View>

          {item.priorityInvestorId && (
            <Text style={styles.priorityInvestorText}>
              ⭐ Priority Investor: {userMap[item.priorityInvestorId] || item.priorityInvestorId}
            </Text>
          )}
        </View>

        <Ionicons
          name={expanded ? 'chevron-up-outline' : 'chevron-forward-outline'}
          size={20}
          color="#A3A3A3"
          style={styles.headerChevron}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedArea}>

          <View style={styles.infoCard}>
            <View style={styles.locationRow}>
              <View style={styles.locationIconCircle}>
                <Ionicons name="location-sharp" size={13} color="#555" />
              </View>
              <Text style={styles.locationRowText} numberOfLines={2}>
                {item.location || 'Dubai, UAE'}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.mapPreviewWrap}
              onPress={() =>
                navigation.navigate('PropertyMap', {
                  latitude: item.latitude,
                  longitude: item.longitude,
                  title: item.title,
                })
              }
            >
              <Image source={mapSampleImage} style={styles.mapPreviewImage} />
              <Image source={buttonMapImage} style={styles.mapButtonOverlay} />
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.yieldRow}>
              <MaterialCommunityIcons name="finance" size={18} color="#2B2B2B" />
              <View style={{ marginLeft: 8 }}>
           <Text style={styles.yieldTitle}>{yieldText}</Text>
                <Text style={styles.yieldSubtext}>Expected Yield</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.docRow, !item.hasPaymentPlan && styles.docRowDisabled]}
            activeOpacity={item.hasPaymentPlan ? 0.85 : 1}
            disabled={!item.hasPaymentPlan}
            onPress={() =>
              navigation.navigate('PaymentPlan', {
                propertyId: item.id,
                readonly: true,
              })
            }
          >
            <Image source={paymentPlanImage} style={styles.docIconImage} />
            <View style={styles.docTextWrap}>
              <Text style={styles.docTitle}>Payment Plan</Text>
              <Text style={styles.docSubtext}>
                {item.hasPaymentPlan ? 'Open payment schedule' : 'No payment plan yet'}
              </Text>
            </View>
          </TouchableOpacity>

       <TouchableOpacity
  style={[styles.docRow, !presentationPdfUrl && styles.docRowDisabled]}
  activeOpacity={presentationPdfUrl ? 0.85 : 1}
  disabled={!presentationPdfUrl}
  onPress={async () => {
    if (!presentationPdfUrl) return;

    const supported = await Linking.canOpenURL(presentationPdfUrl);
    if (!supported) {
      Alert.alert('Error', 'Cannot open PDF');
      return;
    }

    await Linking.openURL(presentationPdfUrl);
  }}
>
  <View style={styles.docIconCircle}>
    <Ionicons name="document-text-outline" size={16} color="#555" />
  </View>
  <View style={styles.docTextWrap}>
    <Text style={styles.docTitle}>{presentationPdfName}</Text>
    <Text style={styles.docSubtext}>
      {presentationPdfUrl ? 'PDF · Open brochure' : 'No PDF uploaded yet'}
    </Text>
  </View>
</TouchableOpacity>

          <View style={styles.statusCard}>
            <View style={styles.inlineStatusBadge}>
              <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
              <Text style={[styles.inlineStatusBadgeText, { color: statusDotColor }]}>
                {propertyStatusLabel}
              </Text>
            </View>

            <View style={styles.timelineRow}>
              <View style={styles.timelineCol}>
                <Text style={styles.timelineLabel}>Commissioning</Text>
                <Text style={styles.timelineValue}>{commissioningText}</Text>
              </View>

              <View style={styles.timelineDivider} />

              <View style={styles.timelineCol}>
                <Text style={styles.timelineLabel}>Planned Sale</Text>
                <Text style={styles.timelineValue}>{plannedSaleText}</Text>
              </View>
            </View>
          </View>

       <View style={styles.aboutCard}>
  <Text style={styles.aboutTitle}>About the property</Text>
  <Text style={styles.aboutText}>
    {aboutText}
  </Text>
</View>
        </View>
      )}

      <View style={{ height: 14 }} />

    <BlueButton
  title={item.hasPaymentPlan ? 'Invest' : 'Object not active'}
  onPress={() =>
    navigation.navigate('BuyShares', {
      propertyId: item.id,
      propertyName: item.title,
    })
  }
  disabled={!item.hasPaymentPlan}
  width="full"
  showArrow={false}
  bgColor={item.hasPaymentPlan ? '#10B981' : '#D1D5DB'}
  textColor={item.hasPaymentPlan ? '#FFFFFF' : '#6B7280'}
  borderColor={item.hasPaymentPlan ? '#10B981' : '#D1D5DB'}
  paddingVertical={12}
  style={styles.investButtonLikeHome}
/>

      <View style={{ height: 8 }} />
    </View>
  );
};

const PropertyListScreen = () => {
  const [videoError, setVideoError] = useState<any>(null);
  const [buffering, setBuffering] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [userMap, setUserMap] = useState<UserMap>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  //const [imageIndex, setImageIndex] = useState(0);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);

useEffect(() => {
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}, []);

  const closeVideo = useCallback(() => {
    setVideoModalVisible(false);
    setVideoUrl(null);
    setVideoError(null);
    setBuffering(false);
  }, []);

  const openImage = (uri: string) => {
    setModalImage(uri);
    setModalVisible(true);
  };

  const openVideo = (url: string) => {
    //Alert.alert('URI', url);
    //console.log(url);
    setVideoError(null);
    setBuffering(true);
    setVideoUrl(url);
    setVideoModalVisible(true);
  };

  useFocusEffect(
    useCallback(() => {
      // const loadProperties = async () => {
      //   try {
      //     const res = await api.get('/properties');

      //     const propertiesWithExtras = await Promise.all(
      //       res.data.map(async (p: Property) => {

      //         const [imgRes, mediaRes, paymentPlanRes] = await Promise.all([
      //           api.get(`/properties/${p.id}/images`),
      //           api.get(`/properties/${p.id}/media`),
      //           api.get(`/properties/${p.id}/payment-plans`),
      //         ]);
      //         const normalizedMedia: PropertyMedia[] = (mediaRes.data ?? []).map((m: ApiMedia) => ({
      //           id: m.id,
      //           type: m.type === 2 ? 'video' : 'image',
      //           url: m.url ?? null,
      //           base64Data: m.base64Data ?? null,
      //          }));

      //         return {
      //           ...p,
      //           images: imgRes.data,
      //           media: normalizedMedia,
      //           hasPaymentPlan: paymentPlanRes.data && paymentPlanRes.data.length > 0,
      //         };
      //       })
      //     );

      //       const sortedProperties = propertiesWithExtras.sort((a, b) =>
      //           a.title.localeCompare(b.title)
      //         );

      //     setProperties(sortedProperties);

      //     const userResponses = await api.get('/properties/with-stats');
      //     const userIds = userResponses.data.filter((p: Property) => p.priorityInvestorId).map((p: Property) => p.priorityInvestorId);
      //     const uniqueIds = [...new Set(userIds)];
      //     const map: UserMap = {};

      //     if (uniqueIds.length > 0) {
      //       const usersRes = await Promise.all(uniqueIds.map((id) => api.get(`/users/${id}`)));
      //       usersRes.forEach((res) => {
      //         const user = res.data;
      //         map[user.id] = user.fullName;
      //       });
      //     }

      //     setUserMap(map);
      //   }
      //    catch (error: any) {
      //                let message = 'Failed to load properties ';
      //                     console.error(error);
      //                     if (error.response && error.response.data) {
      //                       message = JSON.stringify(error.response.data);
      //                     } else if (error.message) {
      //                       message = error.message;
      //                     }
      //                     Alert.alert('Error', 'Failed to load properties ' + message);
      //                   console.error(message);
      //             }

      // };

      // loadProperties();

      const loadProperties = async () => {
        try {
          const data = await fetchPropertiesWithExtras(8); // кеш для первых 8
          setProperties(data);

          const userResponses = await api.get('/properties/with-stats');
          const userIds = userResponses.data
            .filter((p: Property) => p.priorityInvestorId)
            .map((p: Property) => p.priorityInvestorId);

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
          let message = 'Failed to load properties ';
          console.error(error);
          if (error.response && error.response.data) {
            message = JSON.stringify(error.response.data);
          } else if (error.message) {
            message = error.message;
          }
          Alert.alert('Error', 'Failed to load properties ' + message);
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <PropertyCard
            item={item}
            navigation={navigation}
            userMap={userMap}
            openImage={openImage}
            openVideo={openVideo}
            expanded={expandedPropertyId === item.id}
           onToggleExpand={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpandedPropertyId((prev) => (prev === item.id ? null : item.id));
          }}
          />
        )}
      />

      <Modal visible={modalVisible} transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalView}>
          {modalImage && <Image source={{ uri: modalImage }} style={styles.modalImage} />}
        </View>
      </Modal>

      <Modal
        visible={videoModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={closeVideo}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <TouchableOpacity
            onPress={closeVideo}
            style={{
              position: 'absolute',
              top: 40,
              right: 16,
              zIndex: 9999,
              paddingVertical: 10,
              paddingHorizontal: 14,
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 10,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>✖ Close</Text>
          </TouchableOpacity>

          {videoUrl && (
            <View style={{ flex: 1, backgroundColor: '#000' }} renderToHardwareTextureAndroid>
              <Video
                key={videoUrl} // важно: пересоздаёт плеер при смене ссылки
                useTextureView={true}
                source={{ uri: videoUrl }}
                style={{ flex: 1, backgroundColor: '#000' }}
                controls
                resizeMode="contain"
                paused={false}
                playInBackground={false}
                playWhenInactive={false}
                onLoadStart={() => {
                  console.log('VIDEO loadStart', videoUrl);
                  setVideoError(null);
                  setBuffering(true);
                }}
                onLoad={(e) => {
                  console.log('VIDEO loaded', e);
                  setBuffering(false);
                }}
                onBuffer={(e) => {
                  console.log('VIDEO buffer', e);
                  setBuffering(!!e?.isBuffering);
                }}
                onError={(e) => {
                  console.log('VIDEO ERROR', e);
                  setVideoError(e);
                  setBuffering(false);
                }}
              />

              {buffering && (
                <Text style={{ position: 'absolute', top: 60, left: 12, color: '#fff' }}>
                  Loading video...
                </Text>
              )}

              {videoError && (
                <Text
                  style={{
                    position: 'absolute',
                    top: 80,
                    left: 12,
                    right: 12,
                    color: '#ff8080',
                  }}
                >
                  {JSON.stringify(videoError)}
                </Text>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#ECECEC',
    color: theme.colors.text,
  },
  listContent: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    display: 'none',
    color: theme.colors.text,
  },
  text: {
    color: theme.colors.text,
  },

  card: {
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    padding: 14,
    borderRadius: 28,
    marginBottom: 18,
    color: theme.colors.text,
  },

  mediaWrap: {
    position: 'relative',
  },

  statusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },

  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  name: {
    fontWeight: '600',
    fontSize: 20,
    color: '#1F1F1F',
  },

  price: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E1E1E',
    marginTop: 14,
  },

  divider: {
    height: 1,
    backgroundColor: '#E3E3E3',
    marginVertical: 16,
  },

  headerBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },

  headerChevron: {
    marginTop: 4,
  },

  location: {
    marginTop: 8,
    fontSize: 14,
    color: '#A1A1A1',
    lineHeight: 20,
  },

  sharesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  sharesText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#9C9C9C',
    fontWeight: '500',
  },

  priorityInvestorText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },

  expandedArea: {
    marginTop: 16,
  },

  infoCard: {
    backgroundColor: '#F3F3F3',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  locationIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  locationRowText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#666',
  },

  mapPreviewWrap: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },

  mapPreviewImage: {
    width: '100%',
    height: 110,
    borderRadius: 14,
  },

  mapButtonOverlay: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 42,
    height: 42,
    resizeMode: 'contain',
  },

  yieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  yieldTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },

  yieldSubtext: {
    marginTop: 2,
    fontSize: 12,
    color: '#9A9A9A',
  },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F3F3',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },

  docRowDisabled: {
    opacity: 0.65,
  },

  docIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E7E7E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  docIconImage: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
    marginRight: 10,
  },

  docTextWrap: {
    flex: 1,
  },

  docTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },

  docSubtext: {
    marginTop: 2,
    fontSize: 12,
    color: '#9A9A9A',
  },

  statusCard: {
    backgroundColor: '#F3F3F3',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },

  inlineStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  inlineStatusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },

  timelineCol: {
    flex: 1,
  },

  timelineDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 14,
  },

  timelineLabel: {
    fontSize: 12,
    color: '#8A8A8A',
  },

  timelineValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },

  aboutCard: {
    backgroundColor: '#F3F3F3',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },

  aboutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1E1E',
    marginBottom: 8,
  },

  aboutText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#555',
  },

  carouselContainer: {
    alignItems: 'center',
    marginVertical: 1,
  },

  carouselContainerImage: {
    width: '100%',
    height: 220,
    borderRadius: 22,
    backgroundColor: '#E8E8E8',
  },

  carouselContainerText: {
    marginTop: 4,
  },

  swiper: {
    height: 220,
  },

  paginationStyle: {
    bottom: 12,
  },

  swiperDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },

  swiperActiveDot: {
    width: 24,
    height: 8,
    borderRadius: 999,
    marginHorizontal: 3,
    backgroundColor: '#FFFFFF',
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
    gap: 8, // RN 0.71+, иначе можно убрать
    color: theme.colors.text,
    //  marginTop: 4,
  },

  rightNote: {
    textAlign: 'left',
    maxWidth: '70%',
    color: theme.colors.text,
  },

  videoBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    color: theme.colors.text,
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
    color: theme.colors.text,
  },

  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    color: theme.colors.text,
  },

  linkText: {
    // color: theme.colors.primary, // или '#007bff'
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
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
    width: '100%',
    marginTop: 8,
    gap: 8,
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

  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  imageFallbackText: {
    color: '#777',
    fontWeight: '600',
  },
  investButtonLikeHome: {
  shadowOpacity: 0,
  elevation: 0,
  borderRadius: 12,
  marginBottom: 0,
},
});

export default PropertyListScreen;