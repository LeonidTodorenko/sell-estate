import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { RootStackParamList } from '../navigation/AppNavigator';
import theme from '../constants/theme';
import api, { setAccessToken } from '../api';
import { clearSession } from '../services/sessionStorage';
import DemoModeBanner from '../components/DemoModeBanner';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

interface User {
  userId: string;
  fullName: string;
  email: string;
  walletBalance?: string;
  avatarBase64: string | null;
  id?: string;
  phone?: string | null;
  isDemo?: boolean;
  demoCode?: string | null;
}

interface TotalAssetsResponse {
  walletBalance?: number;
  investmentValue?: number;
  pendingApplicationsValue?: number;
  marketValue?: number;
  rentalIncome?: number;
  totalAssets?: number;

  clubStatus?: string | null;
  clubFeePercent?: number | null;
  hasReferrer?: boolean | null;
  baseFeePercent?: number | null;
  referralFeePercent?: number | null;
}

interface UnreadCountResponse {
  count?: number;
}

type ProfileData = {
  user: User;
  unreadCount: number;

  walletBalance: number | null;
  investmentValue: number | null;
  pendingApplicationsValue: number | null;
  marketValue: number | null;
  rentalIncome: number | null;
  totalAssets: number | null;

  clubStatus: string | null;
  clubFeePercent: number | null;
  hasReferrer: boolean | null;
  baseFeePercent: number | null;
  referralFeePercent: number | null;
};

type MenuItemProps = {
  iconSource: any;
  title: string;
  value?: string;
  danger?: boolean;
  onPress: () => void;
  hideDivider?: boolean;
};

const starIcon = require('../assets/images/DarkGradientUse/star.png');
const chartIcon = require('../assets/images/DarkGradientUse/Chart-fill.png');
const idIcon = require('../assets/images/DarkGradientUse/ID.png');
const friendIcon = require('../assets/images/DarkGradientUse/Friend.png');
const lockIcon = require('../assets/images/DarkGradientUse/Lock.png');
const historyIcon = require('../assets/images/DarkGradientUse/History.png');
const settingIcon = require('../assets/images/DarkGradientUse/Setting.png');
const infoIcon = require('../assets/images/DarkGradientUse/Info.png');
const transferIcon = require('../assets/images/DarkGradientUse/Money-transfer.png');
const walletIcon = require('../assets/images/DarkGradientUse/Wallet.png');
const fileTimeIcon = require('../assets/images/DarkGradientUse/file-time.png');
const logoutIcon = require('../assets/images/DarkGradientUse/Logout.png');

function formatMoney(value: number | null) {
  if (value == null) return '—';
  return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * Нормализуем пользователя из legacy AsyncStorage('user').
 * В проекте встречаются разные варианты полей phone и avatar.
 */
function normalizeStoredUser(parsed: any): User {
  return {
    ...parsed,
    userId: parsed.userId ?? parsed.id ?? parsed.user?.id,
    id: parsed.id ?? parsed.userId ?? parsed.user?.id,
    fullName: parsed.fullName ?? parsed.user?.fullName ?? '',
    email: parsed.email ?? parsed.user?.email ?? '',
    avatarBase64:
      parsed.avatarBase64 ??
      parsed.AvatarBase64 ??
      parsed.user?.avatarBase64 ??
      parsed.user?.AvatarBase64 ??
      null,
    phone:
      parsed.phone ??
      parsed.phoneNumber ??
      parsed.user?.phone ??
      parsed.user?.phoneNumber ??
      null,
    isDemo: parsed.isDemo === true || parsed.user?.isDemo === true,
    demoCode: parsed.demoCode ?? parsed.user?.demoCode ?? null,
  };
}

/**
 * Загружаем все данные профиля одним queryFn.
 * Два API-запроса выполняются параллельно.
 */
async function fetchProfileData(userId: string, storedUser: User): Promise<ProfileData> {
  const [assetsResult, unreadResult] = await Promise.allSettled([
    api.get<TotalAssetsResponse>(`/users/${userId}/total-assets`, {
      silentLoading: true,
    } as any),
    api.get<UnreadCountResponse>(`/messages/unread-count/${userId}`, {
      silentLoading: true,
    } as any),
  ]);

  // Assets являются основными данными экрана: их ошибку пробрасываем в React Query.
  if (assetsResult.status === 'rejected') {
    throw assetsResult.reason;
  }

  const assets = assetsResult.value.data ?? {};

  // Ошибка unread count не должна ломать весь ProfileScreen.
  const unreadCount =
    unreadResult.status === 'fulfilled'
      ? unreadResult.value.data?.count ?? 0
      : 0;

  return {
    user: storedUser,
    unreadCount,

    walletBalance:
      typeof assets.walletBalance === 'number' ? assets.walletBalance : null,
    investmentValue:
      typeof assets.investmentValue === 'number' ? assets.investmentValue : null,
    pendingApplicationsValue:
      typeof assets.pendingApplicationsValue === 'number'
        ? assets.pendingApplicationsValue
        : null,
    marketValue:
      typeof assets.marketValue === 'number' ? assets.marketValue : null,
    rentalIncome:
      typeof assets.rentalIncome === 'number' ? assets.rentalIncome : null,
    totalAssets:
      typeof assets.totalAssets === 'number' ? assets.totalAssets : null,

    clubStatus: assets.clubStatus ?? null,
    clubFeePercent:
      typeof assets.clubFeePercent === 'number' ? assets.clubFeePercent : null,
    hasReferrer:
      typeof assets.hasReferrer === 'boolean' ? assets.hasReferrer : null,
    baseFeePercent:
      typeof assets.baseFeePercent === 'number' ? assets.baseFeePercent : null,
    referralFeePercent:
      typeof assets.referralFeePercent === 'number'
        ? assets.referralFeePercent
        : null,
  };
}

const MenuItem = ({
  iconSource,
  title,
  value,
  danger = false,
  onPress,
  hideDivider = false,
}: MenuItemProps) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.menuLeft}>
        <View style={styles.menuIconCircle}>
          <Image source={iconSource} style={styles.menuIcon} resizeMode="contain" />
        </View>

        <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>
          {title}
        </Text>
      </View>

      <View style={styles.menuRight}>
        {!!value && <Text style={styles.menuValue}>{value}</Text>}
        <Ionicons
          name="chevron-forward-outline"
          size={24}
          color={danger ? '#EF4444' : '#A3A3A3'}
        />
      </View>

      {!hideDivider && <View style={styles.menuDivider} />}
    </Pressable>
  );
};

const ProfileScreen = ({ navigation }: Props) => {
  const queryClient = useQueryClient();

  // Здесь хранится только локальная сессия. Данные API находятся в React Query.
  const [storedUser, setStoredUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  /**
   * Один раз читаем legacy AsyncStorage.
   * После полной миграции проекта это можно заменить на AuthContext/loadSession().
   */
  useEffect(() => {
    let mounted = true;

    const loadStoredUser = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');

        if (!stored) {
          navigation.replace('Login');
          return;
        }

        const parsed = JSON.parse(stored);
        const normalized = normalizeStoredUser(parsed);

        if (!normalized.userId) {
          throw new Error('User ID is missing in saved session');
        }

        if (mounted) {
          setStoredUser(normalized);
        }
      } catch (error: any) {
        const message = error?.message || 'Unexpected error loading user';
        Alert.alert('Error', `Failed to get user: ${message}`);
      } finally {
        if (mounted) {
          setSessionLoading(false);
        }
      }
    };

    loadStoredUser();

    return () => {
      mounted = false;
    };
  }, [navigation]);

  const userId = storedUser?.userId ?? null;

  const {
    data: profileData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfileData(userId!, storedUser!),
    enabled: !!userId && !!storedUser,

    // Минуту показываем данные из кеша без нового запроса.
    staleTime: 60_000,

    // Неиспользуемый кеш сохраняется 15 минут.
    gcTime: 15 * 60_000,

    // Не повторяем финансовый запрос несколько раз при серверной ошибке.
    retry: 1,
  });

  const handleLogout = async () => {
    try {
      // Очищаем токен в памяти axios.
      setAccessToken(null);

      // Очищаем новую сессию и legacy user параллельно.
      await Promise.all([
        clearSession().catch(() => undefined),
        AsyncStorage.removeItem('user'),
      ]);

      // Обязательно удаляем пользовательские данные React Query,
      // чтобы следующий пользователь не увидел старый кеш.
      queryClient.clear();

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error: any) {
      const message = error?.message || 'Unexpected error removing user';
      Alert.alert('Error', `Failed to remove user: ${message}`);
    }
  };

  if (sessionLoading || (!profileData && isLoading)) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Loading account...</Text>
      </View>
    );
  }

  if (!storedUser) {
    return null;
  }

  if (isError && !profileData) {
    const message =
      (error as any)?.response?.data?.message ??
      (error as any)?.message ??
      'Failed to load profile';

    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorTitle}>Unable to load account</Text>
        <Text style={styles.errorText}>{String(message)}</Text>

        <Pressable
          onPress={() => refetch()}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  // Пока идет фоновое обновление, продолжаем показывать кешированные данные.
  const data = profileData;
  const user = data?.user ?? storedUser;

  const unreadCount = data?.unreadCount ?? 0;
  const investmentValue = data?.investmentValue ?? null;
  const totalAssets = data?.totalAssets ?? null;
  const walletBalance = data?.walletBalance ?? null;
  const marketValue = data?.marketValue ?? null;
  const pendingApplicationsValue = data?.pendingApplicationsValue ?? null;
  const rentalIncome = data?.rentalIncome ?? null;

  const clubStatus = data?.clubStatus ?? null;
  const clubFeePercent = data?.clubFeePercent ?? null;
  const hasReferrer = data?.hasReferrer ?? null;
  const baseFeePercent = data?.baseFeePercent ?? null;
  const referralFeePercent = data?.referralFeePercent ?? null;

  const topSubtitle = [user.phone, user.email].filter(Boolean).join(' • ');
  const statusValue = clubStatus || '—';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <DemoModeBanner isDemo={storedUser.isDemo} demoCode={storedUser.demoCode} />
      <View style={styles.heroBg}>
        <Pressable
          onPress={() => navigation.navigate('EditProfile')}
          style={({ pressed }) => [
            styles.editButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Image
            source={require('../assets/images/DarkGradientUse/edit.png')}
            style={styles.editIcon}
            resizeMode="contain"
          />
        </Pressable>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          {user.avatarBase64 ? (
            <Image source={{ uri: user.avatarBase64 }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>
                {(user.fullName || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.name}>{user.fullName}</Text>

        <Text style={styles.subInfo} numberOfLines={1}>
          {topSubtitle || user.email}
        </Text>
      </View>

      <View style={styles.menuCard}>
        <MenuItem
          iconSource={starIcon}
          title="Your Status"
          value={statusValue}
          onPress={() => navigation.navigate('Status')}
        />

        <MenuItem
          iconSource={chartIcon}
          title="Statistics"
          onPress={() => navigation.navigate('MyFinance')}
        />

        <MenuItem
          iconSource={idIcon}
          title="Upload KYC"
          onPress={() => navigation.navigate('UploadKyc')}
        />

        <MenuItem
          iconSource={friendIcon}
          title="Invite a Friend"
          onPress={() => navigation.navigate('InviteFriend')}
        />

        <MenuItem
          iconSource={lockIcon}
          title="Change Password"
          onPress={() => navigation.navigate('ChangePassword')}
        />

        <MenuItem
          iconSource={historyIcon}
          title="Transaction History"
          onPress={() => navigation.navigate('UserTransactions')}
        />

        <MenuItem
          iconSource={settingIcon}
          title="Settings"
          onPress={() => navigation.navigate('Settings')}
        />

        <MenuItem
          iconSource={infoIcon}
          title="About App"
          onPress={() => navigation.navigate('About')}
        />

        <MenuItem
          iconSource={transferIcon}
          title="Transfer Money"
          onPress={() => navigation.navigate('TopUp')}
        />

        <MenuItem
          iconSource={walletIcon}
          title="Withdraw Funds"
          onPress={() => navigation.navigate('Withdraw')}
        />

        <MenuItem
          iconSource={fileTimeIcon}
          title="Withdrawal History"
          onPress={() => navigation.navigate('MyWithdrawals')}
        />

        <MenuItem
          iconSource={historyIcon}
          title="Rental Income"
          onPress={() => navigation.navigate('MyRentIncome')}
        />

        {storedUser.isDemo && <MenuItem
          iconSource={chartIcon}
          title="Monthly Reports"
          onPress={() => navigation.navigate('MonthlyReports')}
        />}

        <MenuItem
          iconSource={logoutIcon}
          title="Logout"
          danger
          hideDivider
          onPress={handleLogout}
        />
      </View>

      <View style={styles.assetsCard}>
        <Text style={styles.assetsTitle}>Quick Info</Text>

        <View style={styles.assetRow}>
          <Text style={styles.assetLabel}>Wallet Balance</Text>
          <Text style={styles.assetValue}>{formatMoney(walletBalance)}</Text>
        </View>

        <View style={styles.assetRow}>
          <Text style={styles.assetLabel}>Investment Value</Text>
          <Text style={styles.assetValue}>{formatMoney(investmentValue)}</Text>
        </View>

        {!!pendingApplicationsValue && pendingApplicationsValue !== 0 && (
          <View style={styles.assetRow}>
            <Text style={styles.assetLabel}>Pending Applications</Text>
            <Text style={styles.assetValue}>
              {formatMoney(pendingApplicationsValue)}
            </Text>
          </View>
        )}

        {!!marketValue && marketValue !== 0 && (
          <View style={styles.assetRow}>
            <Text style={styles.assetLabel}>Listed on Market</Text>
            <Text style={styles.assetValue}>{formatMoney(marketValue)}</Text>
          </View>
        )}

        {!!rentalIncome && rentalIncome !== 0 && (
          <View style={styles.assetRow}>
            <Text style={styles.assetLabel}>Rental Income</Text>
            <Text style={styles.assetValue}>{formatMoney(rentalIncome)}</Text>
          </View>
        )}

        <View style={[styles.assetRow, styles.assetRowTotal]}>
          <Text style={styles.assetLabelTotal}>Total Assets</Text>
          <Text style={styles.assetValueTotal}>{formatMoney(totalAssets)}</Text>
        </View>

        {!!clubStatus && (
          <View style={styles.clubBlock}>
            <Text style={styles.clubTitle}>Club status: {clubStatus}</Text>

            {baseFeePercent !== null && referralFeePercent !== null && (
              <Text style={styles.clubText}>
                Standard marketplace fee: {(baseFeePercent * 100).toFixed(1)}%
                {'\n'}
                Discounted fee: {(referralFeePercent * 100).toFixed(1)}%
              </Text>
            )}

            {clubFeePercent !== null && hasReferrer !== null && (
              <Text style={styles.clubText}>
                Your current fee: {(clubFeePercent * 100).toFixed(1)}% (
                {hasReferrer ? 'discount applied' : 'standard fee'}).
              </Text>
            )}
          </View>
        )}

        {!!unreadCount && unreadCount > 0 && (
          <Text style={styles.unreadInfo}>
            Unread inbox messages: {unreadCount}
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECECEC',
  },

  content: {
    paddingBottom: 120,
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECECEC',
  },

  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },

  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#ECECEC',
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },

  errorText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  retryButton: {
    marginTop: 18,
    minWidth: 130,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
  },

  retryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  heroBg: {
    height: 220,
    backgroundColor: '#DCE9E3',
  },

  editButton: {
    position: 'absolute',
    right: 28,
    top: 72,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editIcon: {
    width: 30,
    height: 30,
  },

  profileCard: {
    marginTop: -56,
    marginHorizontal: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingTop: 126,
    paddingBottom: 34,
    paddingHorizontal: 24,
    alignItems: 'center',
  },

  avatarWrap: {
    position: 'absolute',
    top: -78,
    alignSelf: 'center',
    width: 156,
    height: 156,
    borderRadius: 78,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },

  avatar: {
    width: '100%',
    height: '100%',
  },

  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1D5DB',
  },

  avatarFallbackText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#374151',
  },

  name: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: '#171717',
    textAlign: 'center',
  },

  subInfo: {
    marginTop: 10,
    fontSize: 17,
    color: '#8B8B97',
    textAlign: 'center',
  },

  menuCard: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },

  menuItem: {
    minHeight: 96,
    justifyContent: 'center',
    position: 'relative',
  },

  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 120,
  },

  menuRight: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },

  menuIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#F1F1F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },

  menuIcon: {
    width: 30,
    height: 30,
  },

  menuTitle: {
    fontSize: 21,
    fontWeight: '500',
    color: '#171717',
  },

  menuTitleDanger: {
    color: '#EF4444',
  },

  menuValue: {
    fontSize: 18,
    color: '#A0A0AA',
    marginRight: 8,
    fontWeight: '400',
  },

  menuDivider: {
    position: 'absolute',
    left: 76,
    right: 2,
    bottom: 0,
    height: 1,
    backgroundColor: '#ECEEF2',
  },

  assetsCard: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 18,
  },

  assetsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 14,
  },

  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },

  assetLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },

  assetValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },

  assetRowTotal: {
    marginTop: 6,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#ECEEF2',
  },

  assetLabelTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },

  assetValueTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  clubBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#ECEEF2',
  },

  clubTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },

  clubText: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },

  unreadInfo: {
    marginTop: 10,
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});

export default ProfileScreen;
