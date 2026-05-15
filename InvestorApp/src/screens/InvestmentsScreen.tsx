import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  Platform,
  LayoutAnimation,
  UIManager,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useLoading } from '../contexts/LoadingContext';
import Swiper from 'react-native-swiper';
import theme from '../constants/theme';
import BlueButton from '../components/BlueButton';
import DateTimePicker from '@react-native-community/datetimepicker';

import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import mapSampleImage from '../assets/images/map-sample.png';
import buttonMapImage from '../assets/images/button-map.png';
import paymentPlanImage from '../assets/images/paymentplan.png';
import { fetchPropertiesWithExtras, Property } from '../services/properties';
import { Linking } from 'react-native';

interface Investment {
  propertyId: string;
  propertyTitle: string;
  totalShares: number;
  totalInvested: number;
  totalShareValue: number;
  marketShares: number;
  ownershipPercent: number;
  monthlyRentalIncome: number;
  confirmedShares: number;
  confirmedApplications: number;
}

interface GroupedInvestment {
  propertyId: string;
  propertyTitle: string;
  shares: number;
  totalInvested: number;
  averagePrice: number;
  buybackPricePerShare: number | null;
}

type Slide =
  | { kind: 'image'; id: string; uri: string }
  | { kind: 'video'; id: string; uri: string };

const normalizeUrl = (u?: string | null) =>
  (u ?? '').trim().replace(/^http:\/\//i, 'https://');

function formatMoney(value?: number | null) {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatMoneyNoCents(value?: number | null) {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function getPropertyPreview(item?: Property | null): string | null {
  if (!item) return null;

  const firstImage = item.images?.find((img: any) => !!img?.base64Data)?.base64Data;
  if (firstImage) return firstImage;

  const firstMediaImage = item.media?.find((m: any) => {
    const typeString = String(m?.type ?? '').toLowerCase();
    const uri = (m?.base64Data ?? m?.url ?? '').trim();
    const isVideo =
      typeString === 'video' ||
      typeString === '2' ||
      /\.(mp4|mov|webm)(\?.*)?$/i.test(uri);

    return !isVideo && !!uri;
  });

  if (!firstMediaImage) return null;

  const uri = (firstMediaImage.base64Data ?? firstMediaImage.url ?? '').trim();
  if (!uri) return null;

  return uri.startsWith('http://') ? uri.replace(/^http:\/\//i, 'https://') : uri;
}

type SellMode = 'menu' | 'listing';

type SellModalState = {
  visible: boolean;
  investment: Investment | null;
  groupedInvestment: GroupedInvestment | null;
  property: Property | null;
  mode: SellMode;
};

type InvestmentCardProps = {
  investment: Investment;
  property?: Property | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenImage: (uri: string) => void;
  onOpenSell: (investment: Investment, property?: Property | null) => void;
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const InvestmentCard: React.FC<InvestmentCardProps> = ({
  investment,
  property,
  expanded,
  onToggleExpand,
  onOpenImage,
  onOpenSell,
  navigation,
}) => {
  const swiperRef = useRef<Swiper>(null);
  const [index, setIndex] = useState(0);

  const slides: Slide[] = useMemo(() => {
    if (!property) return [];

    const fromImages: Slide[] = (property.images ?? [])
      .filter((img: any) => !!img?.base64Data)
      .map((img: any) => ({
        kind: 'image' as const,
        id: img.id,
        uri: img.base64Data,
      }));

    const fromMedia: Slide[] = (property.media ?? [])
      .map((m: any) => {
        const uriRaw = (m.base64Data ?? m.url ?? '')?.trim();
        const uri = uriRaw.startsWith('http') ? normalizeUrl(uriRaw) : uriRaw;
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
      .filter((x: any): x is Slide => x !== null);

    return [...fromImages, ...fromMedia].filter((s) => !!s.uri);
  }, [property]);

 const totalSlides = slides.length;
const location = property?.location || 'Dubai Hills Estate / Dubai, UAE';
const profit = investment.totalShareValue - investment.totalInvested;
const yieldText =
  property?.expectedYieldText?.trim() || '12-15% per annum (est.)';
const listingType = property?.listingType === 'rent' ? 'For Rent' : 'For Sale';
const statusDotColor = property?.listingType === 'rent' ? '#5B8DEF' : '#10B981';

const commissioningText = property?.expectedCompletionDate
  ? new Date(property.expectedCompletionDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    })
  : 'Q2 2026';

const plannedSaleText = property?.plannedSaleDate
  ? new Date(property.plannedSaleDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    })
  : 'Q4 2027';

const aboutText =
  property?.about?.trim() ||
  `Modern residential complex in the heart of Dubai Hills Estate. Golf course
view. Amenities: pool, fitness, parks, schools, restaurants.
To city center: 15 minutes
To airport: 25 minutes`;

const preview = getPropertyPreview(property);

const presentationPdfUrl = property?.presentationPdfUrl?.trim() || null;
const presentationPdfName = property?.presentationPdfName?.trim() || 'Object Presentation';

  return (
    <View style={styles.card}>
      <View style={styles.mediaWrap}>
        {totalSlides > 0 ? (
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
              {slides.map((slide) => (
                <TouchableOpacity
                  key={slide.id}
                  activeOpacity={0.9}
                  onPress={() => {
                    if (slide.kind === 'image') onOpenImage(slide.uri);
                  }}
                >
                  {slide.kind === 'image' ? (
                    <Image source={{ uri: slide.uri }} style={styles.carouselImage} />
                  ) : (
                    <View style={[styles.carouselImage, styles.videoSlide]}>
                      <Text style={styles.videoSlideText}>▶ Play video</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </Swiper>
          </View>
        ) : (
          <View style={[styles.carouselImage, styles.imageFallback]}>
            <Text style={styles.imageFallbackText}>No media</Text>
          </View>
        )}
      </View>

      <Text style={styles.objectName}>{investment.propertyTitle}</Text>

      {expanded && (
        <View style={styles.expandedArea}>
          <View style={styles.infoCard}>
            <View style={styles.locationRow}>
              <View style={styles.locationIconCircle}>
                <Ionicons name="location-sharp" size={13} color="#555" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.locationRowTitle} numberOfLines={1}>
                  {location}
                </Text>
                <Text style={styles.locationRowSub}>Dubai, UAE</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.mapPreviewWrap}
              onPress={() =>
                navigation.navigate('PropertyMap', {
                  latitude: property?.latitude ?? 25.2048,
                  longitude: property?.longitude ?? 55.2708,
                  title: investment.propertyTitle,
                })
              }
            >
              <Image source={mapSampleImage} style={styles.mapPreviewImage} />
              <Image source={buttonMapImage} style={styles.mapButtonOverlay} />
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.yieldRow}>
              <View style={styles.metricCircle}>
                <MaterialCommunityIcons name="finance" size={18} color="#2B2B2B" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.yieldTitle}>{yieldText}</Text>
                <Text style={styles.yieldSubtext}>Expected Yield</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.docRow, !(property?.hasPaymentPlan ?? false) && styles.docRowDisabled]}
            activeOpacity={property?.hasPaymentPlan ? 0.85 : 1}
            disabled={!property?.hasPaymentPlan}
            onPress={() =>
              navigation.navigate('PaymentPlan', {
                propertyId: investment.propertyId,
                readonly: true,
              })
            }
          >
            <Image source={paymentPlanImage} style={styles.docIconImage} />
            <View style={styles.docTextWrap}>
              <Text style={styles.docTitle}>payment schedule.pdf</Text>
              <Text style={styles.docSubtext}>PDF · 2.4 МБ</Text>
            </View>
          </TouchableOpacity>

      <TouchableOpacity
  style={[styles.docRow, !presentationPdfUrl && styles.docRowDisabled]}
  activeOpacity={presentationPdfUrl ? 0.85 : 1}
  disabled={!presentationPdfUrl}
onPress={async () => {
  if (!presentationPdfUrl) return;

  try {
    const url = normalizeUrl(presentationPdfUrl);

    console.log('PDF URL:', url);

    await Linking.openURL(url);
  } catch (e: any) {
    console.log('PDF open error:', e);

    Alert.alert(
      'Error',
      e?.message
        ? `Cannot open PDF: ${e.message}`
        : 'Cannot open PDF. Please check that a PDF viewer or browser is installed.'
    );
  }
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
                {listingType}
              </Text>
            </View>

            <View style={styles.timelineRow}>
              <View style={styles.timelineCol}>
                <Text style={styles.timelineLabel}>Commissioning</Text>
                <Text style={styles.timelineValue}>{commissioningText}</Text>
              </View>

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

          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Your shares</Text>

            <View style={styles.shareSummaryRow}>
              <View style={styles.shareSummaryLeft}>
                {preview ? (
                  <Image source={{ uri: preview }} style={styles.shareThumb} />
                ) : (
                  <View style={[styles.shareThumb, styles.imageFallback]}>
                    <Text style={styles.imageFallbackText}>No</Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={styles.shareObjectName}>{investment.propertyTitle}</Text>

                  <View style={styles.shareMetaRow}>
                    <MaterialCommunityIcons
                      name="ticket-confirmation-outline"
                      size={14}
                      color="#8E8E93"
                    />
                    <Text style={styles.shareMetaText}>{investment.totalShares} shares</Text>

                    {investment.marketShares > 0 && (
                      <>
                        <Text style={styles.metaDot}>•</Text>
                        <Ionicons name="lock-closed-outline" size={13} color="#A3A3A3" />
                        <Text style={styles.shareMetaText}>
                          {investment.marketShares} shares
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.shareSummaryRight}>
                <Text style={styles.shareValue}>{formatMoney(investment.totalShareValue)}</Text>
                {profit >= 0 ? (
                  <Text style={styles.shareProfit}>↗ + {formatMoneyNoCents(profit)}</Text>
                ) : (
                  <Text style={styles.shareLoss}>↘ - {formatMoneyNoCents(Math.abs(profit))}</Text>
                )}
              </View>
            </View>
          </View>
        </View>
      )}

      <View style={styles.cardButtonsRow}>
        <BlueButton
          title="Sell my shares"
          onPress={() => onOpenSell(investment, property)}
          width="full"
          showArrow={false}
          bgColor="#05060D"
          textColor="#FFFFFF"
          borderColor="#05060D"
          paddingVertical={12}
          style={styles.cardButtonHalf}
        />

        <BlueButton
          title="Invest"
          onPress={() =>
            navigation.navigate('BuyShares', {
              propertyId: investment.propertyId,
              propertyName: investment.propertyTitle,
            })
          }
          width="full"
          showArrow={false}
          bgColor="#10B981"
          textColor="#FFFFFF"
          borderColor="#10B981"
          paddingVertical={12}
          style={styles.cardButtonHalf}
        />
      </View>

      <TouchableOpacity activeOpacity={0.8} onPress={onToggleExpand} style={styles.toggleExpandBtn}>
        <Text style={styles.toggleExpandText}>{expanded ? 'Hide details' : 'More details'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const InvestmentsScreen = () => {
  const { setLoading } = useLoading();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [propertiesMap, setPropertiesMap] = useState<Record<string, Property>>({});
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  const [sellState, setSellState] = useState<SellModalState>({
    visible: false,
    investment: null,
    groupedInvestment: null,
    property: null,
    mode: 'menu',
  });

  const [userId, setUserId] = useState<string>('');

  const [inputShares, setInputShares] = useState('');
  const [inputStartPrice, setInputStartPrice] = useState('');
  const [inputBuyoutPrice, setInputBuyoutPrice] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date>(
    new Date(Date.now() + 7 * 86400000),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const openImage = (uri: string) => {
    setModalImage(uri);
    setModalVisible(true);
  };

  const loadGroupedInvestmentForProperty = useCallback(
    async (uid: string, propertyId: string) => {
      const res = await api.get(`/share-offers/user/${uid}/grouped`);
      const found = (res.data as GroupedInvestment[]).find((x) => x.propertyId === propertyId);
      return found ?? null;
    },
    [],
  );

  const loadInvestments = useCallback(async () => {
    try {
      setLoading(true);

      const stored = await AsyncStorage.getItem('user');
      if (!stored) {
        Alert.alert('Error', 'No user found');
        return;
      }

      const user = JSON.parse(stored);
      setUserId(user.userId);

      const [investmentsRes, propertiesRes] = await Promise.all([
        api.get(`/investments/with-aggregated/${user.userId}`),
        fetchPropertiesWithExtras(50).catch(() => []),
      ]);

      setInvestments(investmentsRes.data ?? []);

      const propMap: Record<string, Property> = {};
      (propertiesRes ?? []).forEach((p: Property) => {
        propMap[p.id] = p;
      });
      setPropertiesMap(propMap);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load investments');
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  useFocusEffect(
    useCallback(() => {
      loadInvestments();
    }, [loadInvestments]),
  );

  const openSellModal = useCallback(
    async (investment: Investment, property?: Property | null) => {
      try {
        if (!userId) return;

        const groupedInvestment = await loadGroupedInvestmentForProperty(userId, investment.propertyId);

        setInputShares('');
        setInputStartPrice('');
        setInputBuyoutPrice('');
        setExpirationDate(new Date(Date.now() + 7 * 86400000));

        setSellState({
          visible: true,
          investment,
          groupedInvestment,
          property: property ?? null,
          mode: 'menu',
        });
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Failed to prepare sale options');
      }
    },
    [userId, loadGroupedInvestmentForProperty],
  );

  const closeSellModal = () => {
    setSellState({
      visible: false,
      investment: null,
      groupedInvestment: null,
      property: null,
      mode: 'menu',
    });
    setShowDatePicker(false);
  };

  const handleSellToPlatform = async () => {
    const grouped = sellState.groupedInvestment;
    if (!grouped || !userId) return;

    Alert.alert(
      'Confirm Sale',
      `Sell ${grouped.shares} shares of ${grouped.propertyTitle} for ${formatMoney(
        (grouped.buybackPricePerShare ?? 0) * grouped.shares,
      )}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sell',
          onPress: async () => {
            try {
              await api.post('/share-offers/sell-to-platform', {
                userId,
                propertyId: grouped.propertyId,
              });

              Alert.alert('Success', 'Shares sold to platform');
              closeSellModal();
              await loadInvestments();
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to sell shares');
            }
          },
        },
      ],
    );
  };

  const submitListing = async () => {
    const grouped = sellState.groupedInvestment;
    if (!grouped || !userId) return;

    const shares = parseInt(inputShares, 10);
    const startPrice = parseFloat(inputStartPrice);
    const buyoutPrice = inputBuyoutPrice ? parseFloat(inputBuyoutPrice) : null;

    if (isNaN(shares) || shares <= 0 || isNaN(startPrice) || startPrice <= 0) {
      Alert.alert('Validation', 'Enter valid shares and start price');
      return;
    }

    if (shares > grouped.shares) {
      Alert.alert('Validation', `You cannot sell more than ${grouped.shares} shares`);
      return;
    }

    const daysDiff = Math.ceil((expirationDate.getTime() - Date.now()) / 86400000);
    if (daysDiff < 7) {
      Alert.alert('Validation', 'Minimum auction duration is 7 days');
      return;
    }

    try {
      await api.post('/share-offers', {
        sellerId: userId,
        propertyId: grouped.propertyId,
        sharesForSale: shares,
        startPricePerShare: startPrice,
        buyoutPricePerShare: buyoutPrice,
        expirationDate: expirationDate.toISOString(),
      });

      Alert.alert('Success', 'Offer listed on marketplace');
      closeSellModal();
      await loadInvestments();
    } catch (error: any) {
      let message = 'Failed to create offer';
      console.error(error);
      if (error.response && error.response.data) {
        message = JSON.stringify(error.response.data);
      } else if (error.message) {
        message = error.message;
      }
      Alert.alert('Error', message);
    }
  };

  const sellPreview = getPropertyPreview(sellState.property);
  const sellProfit =
    (sellState.investment?.totalShareValue ?? 0) - (sellState.investment?.totalInvested ?? 0);

  return (
    <View style={styles.container}>
      <FlatList
        data={investments}
        keyExtractor={(item) => item.propertyId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <InvestmentCard
            investment={item}
            property={propertiesMap[item.propertyId]}
            expanded={expandedPropertyId === item.propertyId}
            onToggleExpand={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setExpandedPropertyId((prev) =>
                prev === item.propertyId ? null : item.propertyId,
              );
            }}
            onOpenImage={openImage}
            onOpenSell={openSellModal}
            navigation={navigation}
          />
        )}
      />

      <Modal visible={modalVisible} transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalView}>
          {modalImage && <Image source={{ uri: modalImage }} style={styles.modalImage} />}
        </View>
      </Modal>

      <Modal
        visible={sellState.visible}
        transparent
        animationType="slide"
        onRequestClose={closeSellModal}
      >
        <View style={styles.sellOverlay}>
          <View style={styles.sellSheet}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sellTitle}>Sell Shares</Text>
            <View style={styles.sellDivider} />

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.sellHeaderRow}>
                <View style={styles.sellHeaderLeft}>
                  {sellPreview ? (
                    <Image source={{ uri: sellPreview }} style={styles.sellThumb} />
                  ) : (
                    <View style={[styles.sellThumb, styles.imageFallback]}>
                      <Text style={styles.imageFallbackText}>No</Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.sellPropertyName}>
                      {sellState.investment?.propertyTitle ?? ''}
                    </Text>

                    <View style={styles.shareMetaRow}>
                      <MaterialCommunityIcons
                        name="ticket-confirmation-outline"
                        size={14}
                        color="#8E8E93"
                      />
                      <Text style={styles.shareMetaText}>
                        {sellState.groupedInvestment?.shares ?? sellState.investment?.totalShares ?? 0}{' '}
                        shares
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.sellHeaderRight}>
                  <Text style={styles.sellHeaderValue}>
                    {formatMoney(sellState.investment?.totalShareValue ?? 0)}
                  </Text>
                  {sellProfit >= 0 ? (
                    <Text style={styles.shareProfit}>↗ + {formatMoneyNoCents(sellProfit)}</Text>
                  ) : (
                    <Text style={styles.shareLoss}>↘ - {formatMoneyNoCents(Math.abs(sellProfit))}</Text>
                  )}
                </View>
              </View>

              {sellState.mode === 'menu' ? (
                <>
                  <Text style={styles.sellQuestion}>How would you like to sell?</Text>

                  {!!sellState.groupedInvestment?.buybackPricePerShare && (
                    <View style={styles.sellOptionCard}>
                      <Text style={styles.sellOptionTitle}>Sell to Platform</Text>
                      <Text style={styles.sellOptionSubtitle}>
                        Instant sale at platform price (buyback).
                      </Text>

                      <View style={styles.sellPriceBlock}>
                        <View>
                          <Text style={styles.sellPriceLabel}>Price</Text>
                          <Text style={styles.sellPriceSub}>Instant crediting</Text>
                        </View>

                        <Text style={styles.sellPriceValue}>
                          ${sellState.groupedInvestment.buybackPricePerShare.toFixed(0)}
                        </Text>
                      </View>

                      <BlueButton
                        title="Sell to Platform"
                        onPress={handleSellToPlatform}
                        width="full"
                        showArrow={false}
                        bgColor="#10B981"
                        textColor="#FFFFFF"
                        borderColor="#10B981"
                        paddingVertical={12}
                        style={styles.modalPrimaryBtn}
                      />
                    </View>
                  )}

                  <View style={styles.sellOptionCard}>
                    <Text style={styles.sellOptionTitle}>Create Listing</Text>
                    <Text style={styles.sellOptionSubtitle}>
                      Set your own price and sale period.
                    </Text>

                    <BlueButton
                      title="Create Listing"
                      onPress={() => setSellState((prev) => ({ ...prev, mode: 'listing' }))}
                      width="full"
                      showArrow={false}
                      bgColor="#05060D"
                      textColor="#FFFFFF"
                      borderColor="#05060D"
                      paddingVertical={12}
                      style={styles.modalPrimaryBtn}
                    />
                  </View>
                </>
              ) : (
                <View style={styles.sellOptionCard}>
                  <Text style={styles.sellOptionTitle}>Create Listing</Text>
                  <Text style={styles.sellOptionSubtitle}>
                    Fill in the parameters for your marketplace listing.
                  </Text>

                  <Text style={styles.modalFieldLabel}>Number of shares</Text>
                  <TextInput
                    placeholder="Number of shares"
                    value={inputShares}
                    onChangeText={setInputShares}
                    keyboardType="numeric"
                    style={styles.modalInput}
                    placeholderTextColor="#9CA3AF"
                  />

                  <Text style={styles.modalFieldLabel}>Start price per share</Text>
                  <TextInput
                    placeholder="Start price per share"
                    value={inputStartPrice}
                    onChangeText={setInputStartPrice}
                    keyboardType="numeric"
                    style={[
                      styles.modalInput,
                      sellState.groupedInvestment &&
                      parseFloat(inputStartPrice) > 0 &&
                      parseFloat(inputStartPrice) < sellState.groupedInvestment.averagePrice
                        ? styles.inputWarning
                        : null,
                    ]}
                    placeholderTextColor="#9CA3AF"
                  />

                  {sellState.groupedInvestment &&
                    parseFloat(inputStartPrice) > 0 &&
                    parseFloat(inputStartPrice) < sellState.groupedInvestment.averagePrice && (
                      <Text style={styles.warningText}>
                        ⚠️ Price is below your average share price
                      </Text>
                    )}

                  <Text style={styles.modalFieldLabel}>Buyout price per share (optional)</Text>
                  <TextInput
                    placeholder="Buyout price per share"
                    value={inputBuyoutPrice}
                    onChangeText={setInputBuyoutPrice}
                    keyboardType="numeric"
                    style={styles.modalInput}
                    placeholderTextColor="#9CA3AF"
                  />

                  <Text style={styles.modalFieldLabel}>Expiration date</Text>
                  <TouchableOpacity activeOpacity={0.85} onPress={() => setShowDatePicker(true)}>
                    <View style={styles.modalInput}>
                      <Text style={styles.expirationText}>
                        {expirationDate.toDateString()}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {showDatePicker && (
                    <DateTimePicker
                      value={expirationDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      minimumDate={new Date(Date.now() + 7 * 86400000)}
                      onChange={(_, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) setExpirationDate(selectedDate);
                      }}
                    />
                  )}

                  <View style={styles.modalActionRow}>
                    <Pressable
                      onPress={() => setSellState((prev) => ({ ...prev, mode: 'menu' }))}
                      style={styles.modalBackBtn}
                    >
                      <Text style={styles.modalBackBtnText}>Back</Text>
                    </Pressable>

                    <BlueButton
                      title="Submit"
                      onPress={submitListing}
                      width="full"
                      showArrow={false}
                      bgColor="#10B981"
                      textColor="#FFFFFF"
                      borderColor="#10B981"
                      paddingVertical={12}
                      style={styles.modalSubmitBtn}
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default InvestmentsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#ECECEC',
  },

  listContent: {
    paddingBottom: 24,
  },

  card: {
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    padding: 14,
    borderRadius: 28,
    marginBottom: 18,
  },

  mediaWrap: {
    position: 'relative',
  },

  carouselContainer: {
    alignItems: 'center',
    marginVertical: 1,
  },

  swiper: {
    height: 220,
  },

  carouselImage: {
    width: '100%',
    height: 220,
    borderRadius: 22,
    backgroundColor: '#E8E8E8',
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

  objectName: {
    fontWeight: '600',
    fontSize: 20,
    color: '#1F1F1F',
    marginTop: 14,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  locationRowTitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#2C2C2C',
    fontWeight: '500',
  },

  locationRowSub: {
    marginTop: 2,
    fontSize: 12,
    color: '#9A9A9A',
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

  metricCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#ECFDF5',
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },

  inlineStatusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  timelineCol: {
    flex: 1,
    backgroundColor: '#EDEDED',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
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

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1E1E',
    marginBottom: 12,
  },

  shareSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  shareSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },

  shareThumb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 10,
    backgroundColor: '#DDE3EA',
  },

  shareObjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },

  shareMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
  },

  shareMetaText: {
    marginLeft: 5,
    fontSize: 13,
    color: '#A3A3A3',
    fontWeight: '500',
  },

  metaDot: {
    marginHorizontal: 6,
    color: '#A3A3A3',
  },

  shareSummaryRight: {
    alignItems: 'flex-end',
  },

  shareValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F1F1F',
  },

  shareProfit: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },

  shareLoss: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },

  cardButtonsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },

  cardButtonHalf: {
    flex: 1,
    marginBottom: 0,
    borderRadius: 12,
    shadowOpacity: 0,
    elevation: 0,
    marginHorizontal: 4,
  },

  toggleExpandBtn: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  toggleExpandText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
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

  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  imageFallbackText: {
    color: '#777',
    fontWeight: '600',
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

  sellOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  sellSheet: {
    backgroundColor: '#F7F7F7',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    maxHeight: '85%',
  },

  sheetHandle: {
    width: 64,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#C4C4C4',
    alignSelf: 'center',
    marginBottom: 18,
  },

  sellTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#171717',
    textAlign: 'center',
    marginBottom: 14,
  },

  sellDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 18,
  },

  sellHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  sellHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },

  sellThumb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 10,
    backgroundColor: '#DDE3EA',
  },

  sellPropertyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 4,
  },

  sellHeaderRight: {
    alignItems: 'flex-end',
  },

  sellHeaderValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
  },

  sellQuestion: {
    fontSize: 22,
    fontWeight: '700',
    color: '#171717',
    marginBottom: 18,
  },

  sellOptionCard: {
    backgroundColor: '#EFEFEF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
  },

  sellOptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#171717',
  },

  sellOptionSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#A1A1A1',
    marginBottom: 18,
  },

  sellPriceBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 18,
  },

  sellPriceLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#171717',
  },

  sellPriceSub: {
    marginTop: 6,
    fontSize: 14,
    color: '#A1A1A1',
  },

  sellPriceValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#10B981',
  },

  modalPrimaryBtn: {
    marginBottom: 0,
    borderRadius: 16,
    shadowOpacity: 0,
    elevation: 0,
  },

  modalFieldLabel: {
    fontSize: 12,
    color: '#8A8A8A',
    marginBottom: 6,
    marginTop: 2,
  },

  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
  },

  expirationText: {
    fontSize: 15,
    color: '#1F1F1F',
  },

  inputWarning: {
    borderColor: '#ff9900',
    backgroundColor: '#fff6e5',
  },

  warningText: {
    color: '#cc6600',
    marginBottom: 8,
    fontStyle: 'italic',
    fontSize: 13,
  },

  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  modalBackBtn: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    marginRight: 10,
  },

  modalBackBtnText: {
    color: '#3F3F46',
    fontSize: 15,
    fontWeight: '500',
  },

  modalSubmitBtn: {
    flex: 1,
    marginBottom: 0,
    borderRadius: 12,
    shadowOpacity: 0,
    elevation: 0,
  },
});