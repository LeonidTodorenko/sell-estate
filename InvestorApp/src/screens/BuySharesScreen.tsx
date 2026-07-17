import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import { RootStackParamList } from '../navigation/AppNavigator';
import StyledInput from '../components/StyledInput';
import theme from '../constants/theme';
import BlueButton from '../components/BlueButton';
import Ionicons from 'react-native-vector-icons/Ionicons';

type BuyRouteProp = RouteProp<RootStackParamList, 'BuyShares'>;

type PropertyImage = {
  id: string;
  base64Data: string;
};

type PropertyLike = {
  id: string;
  title: string;
  location: string;
  price: number;
  totalShares: number;
  availableShares?: number;
  images?: PropertyImage[];
  media?: any[];
};

type PaymentPlanStep = {
  id?: string;
  eventDate: string;
  dueDate: string;
};

type BuySharesData = {
  property: PropertyLike;
  sharePrice: number;
  propertyPreview: string | null;
  isFirstStep: boolean;
};

type InvestmentPayload = {
  userId: string;
  propertyId: string;
  requestedShares: number;
  requestedAmount: number;
  pinOrPassword: string;
};

function money(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function getPropertyPreview(item: PropertyLike | null): string | null {
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

/**
 * Загружает все данные, необходимые экрану покупки.
 *
 * Запросы изображений, media и payment plan выполняются параллельно.
 * React Query кеширует результат отдельно для каждого propertyId.
 */
async function fetchBuySharesData(propertyId: string): Promise<BuySharesData> {
  const [propertiesRes, imagesRes, mediaRes, plansRes] = await Promise.all([
    api.get<PropertyLike[]>('/properties', { silentLoading: true } as any),
    api
      .get<PropertyImage[]>(`/properties/${propertyId}/images`, {
        silentLoading: true,
      } as any)
      .catch(() => ({ data: [] as PropertyImage[] })),
    api
      .get<any[]>(`/properties/${propertyId}/media`, {
        silentLoading: true,
      } as any)
      .catch(() => ({ data: [] as any[] })),
    api
      .get<PaymentPlanStep[]>(`/properties/${propertyId}/payment-plans`, {
        silentLoading: true,
      } as any)
      .catch(() => ({ data: [] as PaymentPlanStep[] })),
  ]);

  const property = propertiesRes.data.find((item) => item.id === propertyId);
  if (!property) {
    throw new Error('Property not found');
  }

  const fullProperty: PropertyLike = {
    ...property,
    images: imagesRes.data ?? [],
    media: mediaRes.data ?? [],
  };

  if (!property.totalShares || property.totalShares <= 0) {
    throw new Error('The property has an invalid total shares value');
  }

  const sharePrice = Number(property.price ?? 0) / Number(property.totalShares);

  // Определяем, является ли текущий активный этап первым этапом плана.
  const plans = Array.isArray(plansRes.data) ? plansRes.data : [];
  let isFirstStep = false;

  if (plans.length > 0) {
    const now = new Date();

    const activeStep = plans.find(
      (plan) =>
        new Date(plan.eventDate).getTime() <= now.getTime() &&
        now.getTime() <= new Date(plan.dueDate).getTime(),
    );

    const firstStep = [...plans].sort(
      (left, right) =>
        new Date(left.eventDate).getTime() - new Date(right.eventDate).getTime(),
    )[0];

    isFirstStep =
      !!activeStep &&
      new Date(activeStep.eventDate).getTime() ===
        new Date(firstStep.eventDate).getTime();
  }

  return {
    property: fullProperty,
    sharePrice,
    propertyPreview: getPropertyPreview(fullProperty),
    isFirstStep,
  };
}

const BuySharesScreen = () => {
  const route = useRoute<BuyRouteProp>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const propertyId = route.params.propertyId;
  const propertyNameFromRoute = route.params.propertyName;

  // Локально оставляем только значения формы и состояние success-экрана.
  const [shares, setShares] = useState('');
  const [pinOrPassword, setPinOrPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [successVisible, setSuccessVisible] = useState(false);
  const [successShares, setSuccessShares] = useState(0);
  const [successAmount, setSuccessAmount] = useState(0);

  /**
   * Данные объекта и payment plan больше не загружаются через два useEffect.
   * При повторном открытии этого объекта React Query сначала отдаст кеш.
   */
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['buyShares', propertyId],
    queryFn: () => fetchBuySharesData(propertyId),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  const property = data?.property ?? null;
  const sharePrice = data?.sharePrice ?? null;
  const propertyPreview = data?.propertyPreview ?? null;
  const isFirstStep = data?.isFirstStep ?? false;

  const parsedShares = Number.parseInt(shares, 10);
  const validShares = Number.isInteger(parsedShares) && parsedShares > 0 ? parsedShares : 0;

  const calculatedAmount = useMemo(
    () => (sharePrice && validShares > 0 ? validShares * sharePrice : 0),
    [sharePrice, validShares],
  );

  /**
   * Покупка оформлена как mutation.
   * React Query сам предоставляет pending-состояние и не даёт путать его
   * с состоянием первоначальной загрузки экрана.
   */
  const investMutation = useMutation({
    mutationFn: async (payload: InvestmentPayload) => {
      return api.post('/investments/apply', payload, {
        silentLoading: true,
      } as any);
    },
    onSuccess: async (_response, variables) => {
      setSuccessShares(variables.requestedShares);
      setSuccessAmount(variables.requestedAmount);
      setSuccessVisible(true);
      setPinOrPassword('');

      // После инвестиции обновляем все экраны, данные которых изменились.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['investments'] }),
        queryClient.invalidateQueries({ queryKey: ['myInvestmentsHistory'] }),
        queryClient.invalidateQueries({ queryKey: ['groupedInvestments'] }),
        queryClient.invalidateQueries({ queryKey: ['properties', 'withExtras'] }),
        queryClient.invalidateQueries({ queryKey: ['buyShares', propertyId] }),
      ]);
    },
    onError: (mutationError: any) => {
      const responseData = mutationError?.response?.data;
      const message =
        responseData?.message ||
        (typeof responseData === 'string' ? responseData : null) ||
        mutationError?.message ||
        'Failed to invest';

      Alert.alert('Error', message);
    },
  });

  const executeBuy = async (
    requestedShares: number,
    requestedAmount: number,
  ) => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) {
        Alert.alert('Error', 'No user found');
        return;
      }

      const user = JSON.parse(stored);
      const userId = user?.userId ?? user?.id ?? user?.user?.id;

      if (!userId) {
        Alert.alert('Error', 'User identifier was not found');
        return;
      }

      investMutation.mutate({
        userId,
        propertyId,
        requestedShares,
        requestedAmount,
        pinOrPassword,
      });
    } catch (sessionError: any) {
      Alert.alert(
        'Error',
        sessionError?.message || 'Failed to read the current user session',
      );
    }
  };

  const handleBuy = () => {
    if (investMutation.isPending) return;

    if (!/^\d+$/.test(shares)) {
      Alert.alert('Validation', 'Only whole number of shares allowed (1, 2, 3...)');
      return;
    }

    const requestedShares = Number.parseInt(shares, 10);
    if (!requestedShares || requestedShares <= 0) {
      Alert.alert('Validation', 'Enter a valid number of shares (whole number > 0)');
      return;
    }

    if (!sharePrice || sharePrice <= 0) {
      Alert.alert('Validation', 'Share price is not loaded yet');
      return;
    }

    if (
      typeof property?.availableShares === 'number' &&
      requestedShares > property.availableShares
    ) {
      Alert.alert(
        'Validation',
        `Only ${property.availableShares} shares are currently available`,
      );
      return;
    }

    if (!pinOrPassword.trim()) {
      Alert.alert('Validation', 'Enter PIN or password');
      return;
    }

    const requestedAmount = sharePrice * requestedShares;

    if (isFirstStep) {
      Alert.alert(
        'Warning',
        'You submit an investment request - it will be reviewed and confirmed later. The funds are temporarily debited.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Ok',
            onPress: () => executeBuy(requestedShares, requestedAmount),
          },
        ],
      );
      return;
    }

    executeBuy(requestedShares, requestedAmount);
  };

  const submitting = investMutation.isPending;

  // Начальная загрузка: запросы идут с silentLoading, поэтому показываем локальный loader.
  if (isLoading) {
    return (
      <View style={styles.queryStateContainer}>
        <ActivityIndicator size="large" color={theme.colors.success} />
        <Text style={styles.queryStateText}>Loading property...</Text>
      </View>
    );
  }

  // Ошибка загрузки с возможностью повторить запрос.
  if (isError || !data) {
    return (
      <View style={styles.queryStateContainer}>
        <Text style={styles.queryStateTitle}>Failed to load property</Text>
        <Text style={styles.queryStateText}>
          {error instanceof Error ? error.message : 'Please try again'}
        </Text>
        <BlueButton
          title="Try again"
          onPress={() => refetch()}
          width="full"
          showArrow={false}
          bgColor="#10B981"
          textColor="#FFFFFF"
          borderColor="#10B981"
          paddingVertical={12}
          style={styles.retryButton}
        />
      </View>
    );
  }

  const orderTitle = property?.title || propertyNameFromRoute || 'Property';
  const orderLocation = property?.location || 'Dubai Hills Estate, Dubai, UAE 77777';
  const pricePerShareText = sharePrice ? `${sharePrice.toFixed(2)} USD` : '—';
  const previewUri = propertyPreview;

  const feeAmount = 16.83; // пока как в дизайне/заглушка
  const feePercentText = '1%';

  const successCard = (
    <View style={styles.successContainer}>
      <View style={styles.successTopArea}>
        <View style={styles.successIconWrap}>
          <View style={styles.successIconInner}>
            <Ionicons name="checkmark" size={28} color="#10B981" />
          </View>
        </View>

        <Text style={styles.successTitle}>Investment Complete!</Text>
        <Text style={styles.successSubtitle}>Shares added to your portfolio</Text>
      </View>

      <View style={styles.successDetailsCard}>
        <Text style={styles.successDetailsTitle}>Order Details</Text>

        <View style={styles.successPropertyRow}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.successPropertyImage} />
          ) : (
            <View style={[styles.successPropertyImage, styles.successPropertyFallback]}>
              <Text style={styles.successPropertyFallbackText}>No</Text>
            </View>
          )}

          <View style={styles.successPropertyTextWrap}>
            <Text style={styles.successPropertyTitle} numberOfLines={1}>
              {orderTitle}
            </Text>
            <Text style={styles.successPropertyLocation} numberOfLines={2}>
              {orderLocation}
            </Text>
          </View>
        </View>

        <View style={styles.successDivider} />

        <View style={styles.successLine}>
          <Text style={styles.successLineLabel}>Shares</Text>
          <Text style={styles.successLineValue}>{successShares}</Text>
        </View>

        <View style={styles.successLine}>
          <Text style={styles.successLineLabel}>Price</Text>
          <Text style={styles.successLineValue}>{money(successAmount)}</Text>
        </View>

        <View style={styles.successLine}>
          <Text style={styles.successLineLabel}>Fee</Text>
          <Text style={styles.successLineValue}>
            ${feeAmount.toFixed(2)} ({feePercentText})
          </Text>
        </View>

        <View style={styles.successDivider} />

        <View style={styles.successTotalRow}>
          <Text style={styles.successTotalLabel}>Total amount:</Text>
          <Text style={styles.successTotalValue}>{money(successAmount)}</Text>
        </View>
      </View>

      <BlueButton
        title="Go to Portfolio"
        onPress={() => navigation.navigate('Investments')}
        width="full"
        showArrow={false}
        bgColor="#F3F4F6"
        textColor={theme.colors.text}
        borderColor="#F3F4F6"
        paddingVertical={12}
        style={styles.successPrimaryButton}
      />

      <Pressable onPress={() => navigation.navigate('Home')} style={styles.successHomeButton}>
        <Text style={styles.successHomeButtonText}>Home</Text>
      </Pressable>
    </View>
  );

  if (successVisible) {
    return successCard;
  }

  return (
    <View style={styles.screen}>
      {/* <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Confirm Purchase</Text>
        <View style={styles.headerRightSpacer} />
      </View> */}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.containerContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.propertyCard}>
          <View style={styles.propertyCardLeft}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.propertyImage} />
            ) : (
              <View style={[styles.propertyImage, styles.propertyImageFallback]}>
                <Text style={styles.propertyImageFallbackText}>No</Text>
              </View>
            )}

            <View style={styles.propertyTextWrap}>
              <Text style={styles.propertyTitle} numberOfLines={1}>
                {orderTitle}
              </Text>
              <Text style={styles.propertyLocation} numberOfLines={1}>
                {orderLocation}
              </Text>
            </View>
          </View>

          <View style={styles.propertyPriceWrap}>
            <Text style={styles.propertyPrice}>{money(sharePrice ?? 0)}</Text>
            <Text style={styles.propertyPriceCaption}>per share</Text>
          </View>
        </View>

        <Text style={styles.inputLabel}>Number of shares</Text>
        <StyledInput
          style={styles.input}
          placeholder=""
          keyboardType="numeric"
          value={shares}
          onChangeText={setShares}
        />

        <Text style={styles.inputLabel}>Enter password to confirm</Text>
        <View style={styles.passwordWrap}>
          <StyledInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Enter password to confirm"
            secureTextEntry={!showPassword}
            value={pinOrPassword}
            onChangeText={setPinOrPassword}
          />
          <Pressable
            onPress={() => setShowPassword((prev) => !prev)}
            style={styles.passwordEye}
          >
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color="#6B7280"
            />
          </Pressable>
        </View>

        <View style={styles.totalBlock}>
          <Text style={styles.totalLabel}>Total amount:</Text>
          <Text style={styles.totalValue}>{money(calculatedAmount)}</Text>
        </View>

        {sharePrice && (
          <Text style={styles.priceHint}>Price per share: {pricePerShareText}</Text>
        )}

        <View style={{ height: 72 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>

        <BlueButton
          title={submitting ? 'Please wait...' : 'Invest'}
          onPress={handleBuy}
          disabled={submitting}
          width="full"
          showArrow={false}
          bgColor="#10B981"
          textColor="#FFFFFF"
          borderColor="#10B981"
          paddingVertical={12}
          style={styles.investButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ECECEC',
  },

  header: {
    height: 92,
    paddingTop: 44,
    paddingHorizontal: 14,
    backgroundColor: '#F7F7F7',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },

  headerRightSpacer: {
    width: 34,
  },

  container: {
    flex: 1,
    backgroundColor: '#ECECEC',
  },

  containerContent: {
    padding: 16,
    paddingBottom: 0,
  },

  propertyCard: {
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  propertyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },

propertyImage: {
  width: 44,
  height: 44,
  borderRadius: 22,
  marginRight: 10,
  backgroundColor: '#DDE3EA',
  overflow: 'hidden',
},

  propertyImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  propertyImageFallbackText: {
    color: '#888',
    fontWeight: '600',
    fontSize: 10,
  },

  propertyTextWrap: {
    flex: 1,
  },

  propertyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1F1F',
  },

  propertyLocation: {
    marginTop: 2,
    fontSize: 12,
    color: '#9CA3AF',
  },

  propertyPriceWrap: {
    alignItems: 'flex-end',
  },

  propertyPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1F1F',
  },

  propertyPriceCaption: {
    marginTop: 2,
    fontSize: 11,
    color: '#9CA3AF',
  },

  inputLabel: {
    fontSize: 12,
    color: '#8A8A8A',
    marginBottom: 6,
    marginTop: 2,
  },

  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },

  passwordWrap: {
    position: 'relative',
  },

  passwordInput: {
    paddingRight: 42,
  },

  passwordEye: {
    position: 'absolute',
    right: 12,
    top: 13,
    zIndex: 5,
  },

  totalBlock: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2A2A2A',
  },

  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },

  priceHint: {
    marginTop: 16,
    fontSize: 12,
    color: '#8A8A8A',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 56,
    backgroundColor: '#ECECEC',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cancelButton: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    height: 46,
  },

  cancelButtonText: {
    color: '#3F3F46',
    fontSize: 15,
    fontWeight: '500',
  },

  investButton: {
    flex: 1,
    marginBottom: 0,
    borderRadius: 10,
    shadowOpacity: 0,
    elevation: 0,
  },

  successContainer: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 24,
  },

  successTopArea: {
    alignItems: 'center',
    marginBottom: 22,
  },

  successIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  successIconInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  successSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },

  successDetailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 22,
  },

  successDetailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 14,
  },

  successPropertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

successPropertyImage: {
  width: 42,
  height: 42,
  borderRadius: 21,
  marginRight: 10,
  backgroundColor: '#DDE3EA',
  overflow: 'hidden',
},

  successPropertyFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  successPropertyFallbackText: {
    color: '#888',
    fontWeight: '600',
    fontSize: 10,
  },

  successPropertyTextWrap: {
    flex: 1,
  },

  successPropertyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },

  successPropertyLocation: {
    marginTop: 2,
    fontSize: 12,
    color: '#8C8C8C',
  },

  successDivider: {
    height: 1,
    backgroundColor: '#ECECEC',
    marginVertical: 10,
  },

  successLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },

  successLineLabel: {
    fontSize: 13,
    color: '#7C7C7C',
  },

  successLineValue: {
    fontSize: 13,
    color: '#1F1F1F',
    fontWeight: '500',
  },

  successTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  successTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
  },

  successTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
  },

  successPrimaryButton: {
    marginBottom: 12,
    borderRadius: 12,
    shadowOpacity: 0,
    elevation: 0,
  },

  successHomeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },

  successHomeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },


  queryStateContainer: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECECEC',
  },

  queryStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },

  queryStateText: {
    marginTop: 10,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  retryButton: {
    width: '100%',
    marginTop: 18,
    marginBottom: 0,
    borderRadius: 10,
    shadowOpacity: 0,
    elevation: 0,
  },
});

export default BuySharesScreen;