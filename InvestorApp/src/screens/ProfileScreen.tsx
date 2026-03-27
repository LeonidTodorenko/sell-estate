import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import theme from '../constants/theme';
import api from '../api';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

interface User {
  fullName: string;
  email: string;
  walletBalance: string;
  avatarBase64: string | null;
  id: string;
  phone?: string | null;
}

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
  const [user, setUser] = useState<User | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [investmentValue, setInvestmentValue] = useState<number | null>(null);
  const [totalAssets, setTotalAssets] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [marketValue, setMarketValue] = useState<number | null>(null);
  const [pendingApplicationsValue, setPendingApplicationsValue] = useState<number | null>(null);
  const [rentalIncome, setRentalIncome] = useState<number | null>(null);

  const [clubStatus, setClubStatus] = useState<string | null>(null);
  const [clubFeePercent, setClubFeePercent] = useState<number | null>(null);
  const [hasReferrer, setHasReferrer] = useState<boolean | null>(null);
  const [baseFeePercent, setBaseFeePercent] = useState<number | null>(null);
  const [referralFeePercent, setReferralFeePercent] = useState<number | null>(null);

  const fetchTotalAssets = async (userId: string) => {
    try {
      const res = await api.get(`/users/${userId}/total-assets`);
      setRentalIncome(res.data.rentalIncome ?? 0);
      setTotalAssets(res.data.totalAssets);
      setInvestmentValue(res.data.investmentValue);
      setWalletBalance(res.data.walletBalance);

      setMarketValue(res.data.marketValue);
      setPendingApplicationsValue(res.data.pendingApplicationsValue);

      setClubStatus(res.data.clubStatus ?? null);
      setClubFeePercent(
        typeof res.data.clubFeePercent === 'number' ? res.data.clubFeePercent : null
      );
      setHasReferrer(
        typeof res.data.hasReferrer === 'boolean' ? res.data.hasReferrer : null
      );
      setBaseFeePercent(
        typeof res.data.baseFeePercent === 'number' ? res.data.baseFeePercent : null
      );
      setReferralFeePercent(
        typeof res.data.referralFeePercent === 'number' ? res.data.referralFeePercent : null
      );
    } catch (error: any) {
      console.error('Failed to fetch total assets', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const fetchAndRefresh = async () => {
        try {
          const stored = await AsyncStorage.getItem('user');
          if (stored) {
            const parsed = JSON.parse(stored);

            setUser({
              ...parsed,
              phone:
                parsed.phone ??
                parsed.phoneNumber ??
                parsed.user?.phone ??
                parsed.user?.phoneNumber ??
                null,
            });

            fetchUnreadCount(parsed.userId);
            fetchTotalAssets(parsed.userId);
          } else {
            navigation.replace('Login');
          }
        } catch (error: any) {
          const message = error.message || 'Unexpected error loading user';
          Alert.alert('Error', 'Failed to get user ' + message);
        }
      };

      fetchAndRefresh();
    }, [navigation]),
  );

  const fetchUnreadCount = async (userId: string) => {
    try {
      const res = await api.get(`/messages/unread-count/${userId}`);
      setUnreadCount(res.data.count || 0);
    } catch (error: any) {
      const message = error.message || 'Unexpected error fetching unread count';
      Alert.alert('Error', 'Failed to fetch unread count: ' + message);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      navigation.replace('Login');
    } catch (error: any) {
      const message = error.message || 'Unexpected error removing user';
      Alert.alert('Error', 'Failed to remove user: ' + message);
    }
  };

  if (!user) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Loading account...</Text>
      </View>
    );
  }

  const topSubtitle = [user.phone, user.email].filter(Boolean).join(' • ');
  const statusValue = clubStatus || '—';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroBg}>
        <Pressable
          onPress={() => navigation.navigate('EditProfile')}
          style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.85 }]}
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
          onPress={() => navigation.navigate('EditProfile')}
        />

        <MenuItem
          iconSource={infoIcon}
          title="About App"
          onPress={() => navigation.navigate('Personal')}
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
            <Text style={styles.assetValue}>{formatMoney(pendingApplicationsValue)}</Text>
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
                Standard marketplace fee: {(baseFeePercent * 100).toFixed(1)}%{'\n'}
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
          <Text style={styles.unreadInfo}>Unread inbox messages: {unreadCount}</Text>
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