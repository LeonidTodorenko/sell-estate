import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  Pressable,
  Image,
  ScrollView,
} from 'react-native';
import api from '../api';
import { formatCurrency } from '../utils/format';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import DateTimePicker from '@react-native-community/datetimepicker';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { fetchPropertiesWithExtras, Property } from '../services/properties';

import historyIcon from '../assets/images/history2_icon.png';

interface ShareOffer {
  id: string;
  sellerId: string;
  propertyId: string;
  propertyTitle: string;
  sharesForSale: number;
  isActive: boolean;
  expirationDate: string;
  startPricePerShare?: number;
  buyoutPricePerShare?: number | null;
}

interface ShareOfferBid {
  id: string;
  offerId: string;
  bidderId: string;
  bidPricePerShare: number;
  shares: number;
  createdAt: string;
}

type MarketTab = 'all' | 'bids' | 'sales';

type PropertyCardInfo = {
  id: string;
  location?: string;
  preview?: string | null;
};

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

function getDaysLeft(expirationDate: string) {
  return Math.max(
    0,
    Math.ceil((new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
}

const MarketHeaderAction = ({
  iconSource,
  onPress,
}: {
  iconSource: any;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.85 }]}>
    <Image source={iconSource} style={styles.headerActionIcon} resizeMode="contain" />
  </Pressable>
);

const MarketTabButton = ({
  label,
  active,
  badge,
  onPress,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={styles.marketTabBtn}>
    <View style={styles.marketTabInner}>
      <Text style={[styles.marketTabText, active && styles.marketTabTextActive]}>{label}</Text>
      {!!badge && badge > 0 && (
        <View style={styles.marketTabBadge}>
          <Text style={styles.marketTabBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </View>
    <View style={[styles.marketTabUnderline, active && styles.marketTabUnderlineActive]} />
  </Pressable>
);

const InlinePasswordField = ({
  value,
  onChangeText,
  placeholder,
  secure,
  setSecure,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secure: boolean;
  setSecure: (v: boolean) => void;
}) => (
  <View style={styles.inlinePasswordWrap}>
    <TextInput
      style={styles.inlinePasswordInput}
      placeholder={placeholder}
      secureTextEntry={secure}
      value={value}
      onChangeText={onChangeText}
      placeholderTextColor="#9CA3AF"
    />
    <Pressable onPress={() => setSecure(!secure)} style={styles.inlinePasswordEye}>
      <Ionicons
        name={secure ? 'eye-off-outline' : 'eye-outline'}
        size={18}
        color="#6B7280"
      />
    </Pressable>
  </View>
);

const ShareMarketplaceScreen = () => {
  const [offers, setOffers] = useState<ShareOffer[]>([]);
  const [bidsMap, setBidsMap] = useState<{ [offerId: string]: ShareOfferBid[] }>({});
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [bidShares, setBidShares] = useState('');
  const [propertiesMap, setPropertiesMap] = useState<Record<string, PropertyCardInfo>>({});

  const [activeTab, setActiveTab] = useState<MarketTab>('all');

  const [bidModalVisible, setBidModalVisible] = useState(false);
  const [buyModalVisible, setBuyModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [extendModalVisible, setExtendModalVisible] = useState(false);

  const [currentOffer, setCurrentOffer] = useState<ShareOffer | null>(null);

  const [bidPrice, setBidPrice] = useState('');
  const [bidPinOrPassword, setBidPinOrPassword] = useState('');
  const [buyPinOrPassword, setBuyPinOrPassword] = useState('');
  const [cancelPinOrPassword, setCancelPinOrPassword] = useState('');
  const [extendPinOrPassword, setExtendPinOrPassword] = useState('');

  const [showBidPassword, setShowBidPassword] = useState(false);
  const [showBuyPassword, setShowBuyPassword] = useState(false);
  const [showCancelPassword, setShowCancelPassword] = useState(false);
  const [showExtendPassword, setShowExtendPassword] = useState(false);

  const [cancelFee, setCancelFee] = useState<number>(0);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [extensionDate, setExtensionDate] = useState<Date | null>(null);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const loadUserId = async () => {
    const stored = await AsyncStorage.getItem('user');
    const user = stored ? JSON.parse(stored) : null;
    if (user) setUserId(user.userId);
  };

  const loadOffers = async () => {
    try {
      setLoading(true);
      const [offersRes, propertiesRes] = await Promise.all([
        api.get<ShareOffer[]>('/share-offers/active'),
        fetchPropertiesWithExtras(50).catch(() => []),
      ]);

      setOffers(offersRes.data);

      const propMap: Record<string, PropertyCardInfo> = {};
      (propertiesRes ?? []).forEach((p: Property) => {
        propMap[p.id] = {
          id: p.id,
          location: p.location ?? 'Dubai',
          preview: getPropertyPreview(p),
        };
      });
      setPropertiesMap(propMap);

      const allBids: { [offerId: string]: ShareOfferBid[] } = {};
      for (const offer of offersRes.data) {
        try {
          const bidRes = await api.get(`/share-offers/${offer.id}/bids`);
          allBids[offer.id] = bidRes.data ?? [];
        } catch (err) {
          console.warn(`Failed to load bids for offer ${offer.id}`);
        }
      }
      setBidsMap(allBids);
    } catch (error: any) {
      let message = 'Failed to load offers ';
      console.error(error);
      if (error.response && error.response.data) {
        message = JSON.stringify(error.response.data);
      } else if (error.message) {
        message = error.message;
      }
      Alert.alert('Error', 'Failed to load offers ' + message);
      console.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadBidsForOffer = async (offerId: string) => {
    try {
      const res = await api.get(`/share-offers/${offerId}/bids`);
      setBidsMap((prev) => ({ ...prev, [offerId]: res.data ?? [] }));
    } catch {
      console.warn('Failed to load bids');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUserId();
      loadOffers();
    }, [])
  );

const allListings = useMemo(() => offers, [offers]);

  const myBidListings = useMemo(() => {
    if (!userId) return [];
    return offers.filter((offer) =>
      (bidsMap[offer.id] ?? []).some((bid) => bid.bidderId === userId),
    );
  }, [offers, bidsMap, userId]);

  const mySalesListings = useMemo(
    () => offers.filter((o) => o.sellerId === userId),
    [offers, userId],
  );

  const currentData = useMemo(() => {
    if (activeTab === 'bids') return myBidListings;
    if (activeTab === 'sales') return mySalesListings;
    return allListings;
  }, [activeTab, allListings, myBidListings, mySalesListings]);

  const myBidCount = myBidListings.length;
  const mySalesCount = mySalesListings.length;

const openBidModal = (offer: ShareOffer) => {
  if (offer.sellerId === userId) {
    Alert.alert('Validation', 'You cannot place a bid on your own listing');
    return;
  }

  setCurrentOffer(offer);
  setBidPrice('');
  setBidShares(String(offer.sharesForSale));
  setBidPinOrPassword('');
  setShowBidPassword(false);
  setBidModalVisible(true);
};

const openBuyModal = (offer: ShareOffer) => {
  if (offer.sellerId === userId) {
    Alert.alert('Validation', 'You cannot buy your own listing');
    return;
  }

  setCurrentOffer(offer);
  setBuyPinOrPassword('');
  setShowBuyPassword(false);
  setBuyModalVisible(true);
};

  const openCancelModal = async (offer: ShareOffer) => {
    try {
      const res = await api.get('/admin/stats/settings/cancel-fee');
      setCancelFee(parseFloat(res.data));
    } catch {
      setCancelFee(0);
    }

    setCurrentOffer(offer);
    setCancelPinOrPassword('');
    setShowCancelPassword(false);
    setCancelModalVisible(true);
  };

  const openExtendModal = (offer: ShareOffer) => {
    setCurrentOffer(offer);
    setExtensionDate(new Date(offer.expirationDate));
    setExtendPinOrPassword('');
    setShowExtendPassword(false);
    setExtendModalVisible(true);
  };

  const submitBid = async () => {
    const price = parseFloat(bidPrice);
    const shares = parseInt(bidShares, 10);

    if (!currentOffer || !userId) return;

    const minPrice = currentOffer.startPricePerShare ?? 0;

    if (isNaN(price) || price <= 0) {
      Alert.alert('Validation', 'Enter a valid bid price');
      return;
    }

    if (price < minPrice) {
      Alert.alert('Validation', `Minimum price per share: ${formatCurrency(minPrice)}`);
      return;
    }

    if (!Number.isInteger(shares) || shares <= 0) {
      Alert.alert('Validation', 'Enter a valid number of shares');
      return;
    }

    if (shares > currentOffer.sharesForSale) {
      Alert.alert('Validation', `Maximum available: ${currentOffer.sharesForSale} shares`);
      return;
    }

    if (!bidPinOrPassword) {
      Alert.alert('Validation', 'Enter PIN or password');
      return;
    }

    try {
      await api.post(`/share-offers/${currentOffer.id}/bid`, {
        bidderId: userId,
        bidPricePerShare: price,
        shares,
        pinOrPassword: bidPinOrPassword,
      });

      Alert.alert('Success', 'Bid placed');
      setBidModalVisible(false);
      loadBidsForOffer(currentOffer.id);
    } catch (error: any) {
      console.error(error.response?.data);
      Alert.alert(
        'Error',
        error?.response?.data?.message ||
          error?.response?.data ||
          'Failed to place bid',
      );
    }
  };

  const handleBuyNow = async () => {
    if (!currentOffer || !userId) return;
    if (!buyPinOrPassword) {
      Alert.alert('Validation', 'Enter PIN or password');
      return;
    }

    try {
      await api.post(`/share-offers/${currentOffer.id}/buy`, {
        buyerId: userId,
        sharesToBuy: currentOffer.sharesForSale,
        pinOrPassword: buyPinOrPassword,
      });

      Alert.alert('Success', 'Purchase completed');
      setBuyModalVisible(false);
      loadOffers();
    } catch (error: any) {
      console.error(error.response?.data);
      Alert.alert(
        'Error',
        error?.response?.data?.message ||
          error?.response?.data ||
          'Purchase failed',
      );
    }
  };

  const handleCancelOffer = async () => {
    if (!currentOffer) return;
    if (!cancelPinOrPassword) {
      Alert.alert('Validation', 'Enter PIN or password');
      return;
    }

    try {
      await api.post(`/share-offers/${currentOffer.id}/cancel`, {
        pinOrPassword: cancelPinOrPassword,
      });
      Alert.alert('Success', 'Offer canceled');
      setCancelModalVisible(false);
      loadOffers();
    } catch (error: any) {
      let message = 'Failed to cancel offer ';
      console.error(error);
      if (error.response && error.response.data) {
        message = JSON.stringify(error.response.data);
      } else if (error.message) {
        message = error.message;
      }
      Alert.alert('Error', message);
    }
  };

  const handleExtendOffer = async () => {
    if (!currentOffer || !extensionDate) return;
    if (!extendPinOrPassword) {
      Alert.alert('Validation', 'Enter PIN or password');
      return;
    }

    const currentExp = new Date(currentOffer.expirationDate);
    if (extensionDate <= currentExp) {
      Alert.alert('Validation', 'New expiration date must be after current expiration.');
      return;
    }

    try {
      await api.post(`/share-offers/${currentOffer.id}/extend-to`, {
        newDate: extensionDate.toISOString(),
        pinOrPassword: extendPinOrPassword,
      });

      Alert.alert('Success', 'Offer extended');
      setExtendModalVisible(false);
      loadOffers();
    } catch (error: any) {
      let message = 'Failed to extend offer';
      if (error instanceof Error) {
        message = error.message;
      } else if (error?.response?.data) {
        message = JSON.stringify(error.response.data);
      }
      Alert.alert('Error', message);
    }
  };

  const renderOfferCard = ({ item }: { item: ShareOffer }) => {
    const propertyInfo = propertiesMap[item.propertyId];
    const preview = propertyInfo?.preview;
    const location = propertyInfo?.location || 'Dubai';
    const daysLeft = getDaysLeft(item.expirationDate);
    const bids = bidsMap[item.id] ?? [];
    const myBids = bids.filter((b) => b.bidderId === userId);
    const latestMyBid = myBids.length > 0 ? myBids[0] : null;
    const isMyListing = item.sellerId === userId;

    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTopLeft}>
            {preview ? (
              <Image source={{ uri: preview }} style={styles.cardThumb} />
            ) : (
              <View style={[styles.cardThumb, styles.imageFallback]}>
                <Text style={styles.imageFallbackText}>No</Text>
              </View>
            )}

            <View style={styles.cardTitleWrap}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.propertyId })}
              >
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.propertyTitle}
                </Text>
              </TouchableOpacity>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {location}
              </Text>
            </View>
          </View>

          <View style={styles.cardPriceWrap}>
            <Text style={styles.cardPrice}>
              {formatCurrency(item.buyoutPricePerShare ?? item.startPricePerShare ?? 0)}
            </Text>
            <Text style={styles.cardPriceCaption}>per share</Text>
          </View>
        </View>

     <View style={styles.cardMiddleRow}>
      <View>
        <Text style={styles.metaLabel}>Buyout price</Text>
      </View>

      {activeTab === 'bids' && latestMyBid ? (
        <View style={styles.rightMetaBox}>
          <Text style={styles.myBidValue}>{formatCurrency(latestMyBid.bidPricePerShare)}</Text>
          <Text style={styles.rightMetaSubText}>My bid</Text>
        </View>
      ) : (
        <View style={styles.rightMetaBox}>
          <Text style={styles.metaValue}>
            {item.buyoutPricePerShare != null ? formatCurrency(item.buyoutPricePerShare) : '—'}
          </Text>
          <Text style={styles.rightMetaSubText}>{bids.length} offers</Text>
        </View>
      )}
    </View>

        <View style={styles.metaBottomRow}>
          <View style={styles.inlineMeta}>
            <MaterialCommunityIcons
              name="ticket-confirmation-outline"
              size={15}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.inlineMetaText}>{item.sharesForSale} shares</Text>
          </View>

          <View style={styles.inlineMeta}>
            <Ionicons name="time-outline" size={15} color={theme.colors.success} />
            <Text style={styles.daysLeftText}>{daysLeft} days left</Text>
          </View>
        </View>

      {activeTab === 'sales' ? (
  <>
    {bids.length > 0 && (
      <View style={styles.salesDetailsBlock}>
        <Text style={styles.salesBlockTitle}>Bids</Text>
        {bids.map((bid) => (
          <View key={bid.id} style={styles.bidRow}>
            <View>
              <Text style={styles.bidPriceText}>{formatCurrency(bid.bidPricePerShare)}</Text>
              <Text style={styles.bidSubText}>
                {bid.shares} shares · {new Date(bid.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ))}
      </View>
    )}

    <View style={styles.salesButtonsRow}>
      <BlueButton
        title="Cancel Listing"
        onPress={() => openCancelModal(item)}
        width="full"
        showArrow={false}
        bgColor="#FEE2E2"
        textColor="#DC2626"
        borderColor="#FEE2E2"
        paddingVertical={10}
        style={styles.salesActionButton}
      />
      <BlueButton
        title="Extend"
        onPress={() => openExtendModal(item)}
        width="full"
        showArrow={false}
        bgColor="#111827"
        textColor="#FFFFFF"
        borderColor="#111827"
        paddingVertical={10}
        style={styles.salesActionButton}
      />
    </View>
  </>
) : isMyListing ? (
  <View style={styles.actionButtonsRow}>
    <BlueButton
      title="More details"
      onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.propertyId })}
      width="full"
      showArrow={false}
      bgColor="#111827"
      textColor="#FFFFFF"
      borderColor="#111827"
      paddingVertical={10}
      style={styles.singleActionButton}
    />
  </View>
) : (
  <View style={styles.actionButtonsRow}>
    {item.buyoutPricePerShare != null ? (
      <BlueButton
        title="Buy now"
        onPress={() => openBuyModal(item)}
        width="full"
        showArrow={false}
        bgColor="#F3F4F6"
        textColor={theme.colors.text}
        borderColor="#F3F4F6"
        paddingVertical={10}
        style={styles.actionButtonHalf}
      />
    ) : (
      <View style={styles.actionButtonHalfPlaceholder} />
    )}

    <BlueButton
      title="Place Bid"
      onPress={() => openBidModal(item)}
      width="full"
      showArrow={false}
      bgColor="#10B981"
      textColor="#FFFFFF"
      borderColor="#10B981"
      paddingVertical={10}
      style={styles.actionButtonHalf}
    />
  </View>
)}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {/* <Text style={styles.headerTitle}>Market</Text> */}
        <MarketHeaderAction
          iconSource={historyIcon}
          onPress={() => navigation.navigate('TradeHistory')}
        />
      </View>

      <View style={styles.tabsRow}>
        <MarketTabButton
          label="All Listings"
          active={activeTab === 'all'}
          onPress={() => setActiveTab('all')}
        />
        <MarketTabButton
          label="My Bids"
          active={activeTab === 'bids'}
          onPress={() => setActiveTab('bids')}
        />
        <MarketTabButton
          label="My Listings"
          active={activeTab === 'sales'}
          badge={mySalesCount}
          onPress={() => setActiveTab('sales')}
        />
      </View>

      <FlatList
        data={currentData}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadOffers}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {activeTab === 'all'
                ? 'No active listings'
                : activeTab === 'bids'
                  ? 'You have no bids yet'
                  : 'You have no active sales'}
            </Text>
          </View>
        }
        renderItem={renderOfferCard}
      />

      <Modal visible={bidModalVisible} transparent animationType="slide" onRequestClose={() => setBidModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.bottomModal}>
            <Text style={styles.modalTitle}>Place a Bid</Text>

            {currentOffer && (
              <View style={styles.modalOfferSummary}>
                <Text style={styles.modalOfferTitle}>{currentOffer.propertyTitle}</Text>
                <Text style={styles.modalOfferPrice}>
                  {formatCurrency(currentOffer.startPricePerShare ?? 0)} min / share
                </Text>
              </View>
            )}

            <Text style={styles.modalLabel}>Number of shares</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="1"
              keyboardType="numeric"
              value={bidShares}
              onChangeText={setBidShares}
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.modalLabel}>Price per share</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="1250"
              keyboardType="numeric"
              value={bidPrice}
              onChangeText={setBidPrice}
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.modalLabel}>Enter password to confirm</Text>
            <InlinePasswordField
              value={bidPinOrPassword}
              onChangeText={setBidPinOrPassword}
              placeholder="Enter password to confirm"
              secure={!showBidPassword}
              setSecure={(v) => setShowBidPassword(!v)}
            />

            <View style={styles.modalBottomButtons}>
              <Pressable onPress={() => setBidModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <BlueButton
                title="Place Bid"
                onPress={submitBid}
                width="full"
                showArrow={false}
                bgColor="#10B981"
                textColor="#FFFFFF"
                borderColor="#10B981"
                paddingVertical={12}
                style={styles.modalConfirmBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={buyModalVisible} transparent animationType="slide" onRequestClose={() => setBuyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.bottomModal}>
            <Text style={styles.modalTitle}>Confirm Purchase</Text>

            {currentOffer && (
              <View style={styles.confirmSummaryCard}>
                <View style={styles.confirmSummaryRow}>
                  <Text style={styles.confirmSummaryLabel}>Shares</Text>
                  <Text style={styles.confirmSummaryValue}>{currentOffer.sharesForSale}</Text>
                </View>
                <View style={styles.confirmSummaryRow}>
                  <Text style={styles.confirmSummaryLabel}>Price / share</Text>
                  <Text style={styles.confirmSummaryValue}>
                    {formatCurrency(currentOffer.buyoutPricePerShare ?? 0)}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.modalLabel}>Enter password to confirm</Text>
            <InlinePasswordField
              value={buyPinOrPassword}
              onChangeText={setBuyPinOrPassword}
              placeholder="Enter password to confirm"
              secure={!showBuyPassword}
              setSecure={(v) => setShowBuyPassword(!v)}
            />

            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Total amount:</Text>
              <Text style={styles.totalRowValue}>
                {formatCurrency(
                  (currentOffer?.buyoutPricePerShare ?? 0) * (currentOffer?.sharesForSale ?? 0),
                )}
              </Text>
            </View>

            <View style={styles.modalBottomButtons}>
              <Pressable onPress={() => setBuyModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <BlueButton
                title="Buy"
                onPress={handleBuyNow}
                width="full"
                showArrow={false}
                bgColor="#10B981"
                textColor="#FFFFFF"
                borderColor="#10B981"
                paddingVertical={12}
                style={styles.modalConfirmBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={cancelModalVisible} transparent animationType="slide" onRequestClose={() => setCancelModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.bottomModal}>
            <Text style={styles.modalTitle}>Cancel Listing</Text>
            <Text style={styles.warningText}>
              Canceling this listing will deduct a fee of {formatCurrency(cancelFee)} from your balance.
            </Text>

            <Text style={styles.modalLabel}>Enter password to confirm</Text>
            <InlinePasswordField
              value={cancelPinOrPassword}
              onChangeText={setCancelPinOrPassword}
              placeholder="Enter password to confirm"
              secure={!showCancelPassword}
              setSecure={(v) => setShowCancelPassword(!v)}
            />

            <View style={styles.modalBottomButtons}>
              <BlueButton
                title="No, Keep"
                onPress={() => setCancelModalVisible(false)}
                width="full"
                showArrow={false}
                bgColor="#F3F4F6"
                textColor={theme.colors.text}
                borderColor="#F3F4F6"
                paddingVertical={12}
                style={styles.modalDualBtn}
              />
              <BlueButton
                title="Yes, Cancel"
                onPress={handleCancelOffer}
                width="full"
                showArrow={false}
                bgColor="#10B981"
                textColor="#FFFFFF"
                borderColor="#10B981"
                paddingVertical={12}
                style={styles.modalDualBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={extendModalVisible} transparent animationType="slide" onRequestClose={() => setExtendModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.bottomModal}>
            <Text style={styles.modalTitle}>Extend Listing</Text>

            <Pressable onPress={() => setShowDatePicker(true)} style={styles.datePickerButton}>
              <Text style={styles.datePickerButtonText}>
                {extensionDate ? extensionDate.toLocaleDateString() : 'Select new date'}
              </Text>
            </Pressable>

            <Text style={styles.modalLabel}>Enter password to confirm</Text>
            <InlinePasswordField
              value={extendPinOrPassword}
              onChangeText={setExtendPinOrPassword}
              placeholder="Enter password to confirm"
              secure={!showExtendPassword}
              setSecure={(v) => setShowExtendPassword(!v)}
            />

            <View style={styles.modalBottomButtons}>
              <Pressable onPress={() => setExtendModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <BlueButton
                title="Confirm"
                onPress={handleExtendOffer}
                width="full"
                showArrow={false}
                bgColor="#10B981"
                textColor="#FFFFFF"
                borderColor="#10B981"
                paddingVertical={12}
                style={styles.modalConfirmBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={extensionDate ?? new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_, selected) => {
            setShowDatePicker(false);
            if (selected) setExtensionDate(selected);
          }}
        />
      )}
    </View>
  );
};

export default ShareMarketplaceScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 24,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },

  headerAction: {
    position: 'absolute',
    top:-16,
    right: 0,
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },

  headerActionIcon: {
    width: 50,
    height: 50,
  },

  tabsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },

  marketTabBtn: {
    flex: 1,
    alignItems: 'center',
  },

  marketTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
  },

  marketTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
  },

  marketTabTextActive: {
    color: theme.colors.text,
  },

  marketTabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F43F5E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 4,
  },

  marketTabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  marketTabUnderline: {
    marginTop: 8,
    width: '100%',
    height: 2,
    backgroundColor: 'transparent',
    borderRadius: 999,
  },

  marketTabUnderlineActive: {
    backgroundColor: theme.colors.text,
  },

  listContent: {
    paddingBottom: 120,
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 12,
  },

  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  cardTopLeft: {
    flexDirection: 'row',
    flex: 1,
    paddingRight: 8,
  },

  cardThumb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DDE3EA',
    marginRight: 10,
  },

  cardTitleWrap: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },

  cardSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  cardPriceWrap: {
    alignItems: 'flex-end',
  },

  cardPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },

  cardPriceCaption: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  cardMiddleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },

 rightMetaBox: {
  alignItems: 'flex-end',
  minWidth: 90,
},

  metaLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },

  metaValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },

  myBidValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.success,
  },

  metaBottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  inlineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  inlineMetaText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 5,
  },

  daysLeftText: {
    fontSize: 12,
    color: theme.colors.success,
    marginLeft: 5,
    fontWeight: '600',
  },

  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 12,
  },

  actionButtonHalf: {
    flex: 1,
    marginBottom: 0,
    borderRadius: 10,
    shadowOpacity: 0,
    elevation: 0,
    marginHorizontal: 4,
  },

  actionButtonHalfPlaceholder: {
    flex: 1,
    marginHorizontal: 4,
  },

  salesDetailsBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },

  salesBlockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },

  bidRow: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },

  bidPriceText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },

  bidSubText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  salesButtonsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },

  salesActionButton: {
    flex: 1,
    marginBottom: 0,
    borderRadius: 10,
    shadowOpacity: 0,
    elevation: 0,
    marginHorizontal: 4,
  },

  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: 20,
    alignItems: 'center',
  },

  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },

  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  imageFallbackText: {
    color: '#888',
    fontSize: 10,
    fontWeight: '600',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
  },

  bottomModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 24,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 14,
    textAlign: 'center',
  },

  modalOfferSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
singleActionButton: {
  flex: 1,
  marginBottom: 0,
  borderRadius: 10,
  shadowOpacity: 0,
  elevation: 0,
  marginHorizontal: 4,
},
  modalOfferTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },

  modalOfferPrice: {
    marginTop: 4,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },

  modalLabel: {
    fontSize: 12,
    color: '#8A8A8A',
    marginBottom: 6,
  },

  modalInput: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    marginBottom: 14,
    color: theme.colors.text,
  },

  inlinePasswordWrap: {
    position: 'relative',
    marginBottom: 14,
  },

  inlinePasswordInput: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingRight: 42,
    color: theme.colors.text,
  },

  inlinePasswordEye: {
    position: 'absolute',
    right: 12,
    top: 15,
  },

  modalBottomButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  modalCancelBtn: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    marginRight: 10,
  },

  modalCancelText: {
    fontSize: 15,
    color: '#3F3F46',
    fontWeight: '500',
  },

  modalConfirmBtn: {
    flex: 1,
    marginBottom: 0,
    borderRadius: 10,
    shadowOpacity: 0,
    elevation: 0,
  },

  modalDualBtn: {
    flex: 1,
    marginBottom: 0,
    borderRadius: 10,
    shadowOpacity: 0,
    elevation: 0,
    marginHorizontal: 4,
  },

  confirmSummaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },

  confirmSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },

  confirmSummaryLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },

  confirmSummaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },

  totalRow: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },

  totalRowValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.success,
  },

  warningText: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginBottom: 14,
  },

  datePickerButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 14,
  },

  datePickerButtonText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  rightMetaSubText: {
  marginTop: 4,
  fontSize: 12,
  color: theme.colors.textSecondary,
},
});