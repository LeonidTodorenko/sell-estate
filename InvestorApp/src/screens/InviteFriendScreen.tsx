// screens/InviteFriendScreen.tsx
import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  FlatList,
  Image,
  ScrollView,
} from 'react-native';
import StyledInput from '../components/StyledInput';
import BlueButton from '../components/BlueButton';
import api from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ErrorState from '../components/ErrorState';
import ScreenLoader from '../components/ScreenLoader';
import {clubPercent} from '../utils/clubDisplay';

// These requests are represented by local loading/error UI.
const localRequestUI = {silentLoading: true, silentError: true} as any;

type InviteRow = {
  id: string;
  inviteeEmail: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  status: string;
};

type ClubInfo = {
  totalAssets: number;
  status: string;
  baseFee: number;
  withReferralFee: number;
  canInvite: boolean;
  referrerRewardPercent: number;
  referrerRewardYears: number;
};

type InviteVisualStatus = {
  kind: 'success' | 'pending' | 'failed';
  text: string;
  color: string;
  icon: string;
};

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString('en-US');
}

function getInviteStatusMeta(item: InviteRow): InviteVisualStatus {
  const s = String(item.status || '').toLowerCase();

  if (
    s.includes('accepted') ||
    s.includes('completed') ||
    s.includes('rewarded') ||
    s.includes('success')
  ) {
    return {
      kind: 'success',
      text: item.acceptedAt
        ? `Accepted · ${formatShortDate(item.acceptedAt)}`
        : `Accepted · ${formatShortDate(item.createdAt)}`,
      color: '#098653',
      icon: 'checkmark',
    };
  }

  if (
    s.includes('expired') ||
    s.includes('rejected') ||
    s.includes('failed') ||
    s.includes('cancel')
  ) {
    return {
      kind: 'failed',
      text: 'Expired · Conditions not met',
      color: '#E11D48',
      icon: 'close',
    };
  }

  return {
    kind: 'pending',
    text: `Registered: ${formatShortDate(item.createdAt)}`,
    color: '#52675e',
    icon: 'time',
  };
}

function getInitials(email: string) {
  const local = (email || '').split('@')[0] || 'U';
  const parts = local.split(/[.\-_]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

const HowItWorksItem = ({
  title,
  isLast = false,
  done = false,
}: {
  title: string;
  isLast?: boolean;
  done?: boolean;
}) => {
  return (
    <View style={styles.howRow}>
      <View style={styles.howLeft}>
        <View style={[styles.howDot, done && styles.howDotDone]}>
          <View style={styles.howDotInner} />
        </View>
        {!isLast && <View style={styles.howLine} />}
      </View>

      <Text style={styles.howText}>{title}</Text>
    </View>
  );
};

export default function InviteFriendScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [list, setList] = useState<InviteRow[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadInvites = async () => {
    try {
      const {data} = await api.get('/referrals/my-invites', localRequestUI);
      setList(
        Array.isArray(data)
          ? [...data].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
          : [],
      );
    } catch (e: any) {
      console.error(e);
      setLoadError(true);
    }
  };

  const loadClubInfo = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;

      const parsed = JSON.parse(stored);
      const userId = parsed.userId as string;
      if (!userId) return;

      const {data} = await api.get(`/share-offers/${userId}/club-info`, localRequestUI);
      setClubInfo(data);
    } catch (e: any) {
      console.error(e);
      setLoadError(true);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setIsDemo(parsed.isDemo === true || parsed.user?.isDemo === true);
      }
      await Promise.all([loadInvites(), loadClubInfo()]);
    } catch (_) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const sendInvite = async () => {
    if (isDemo) {
      Alert.alert(
        'Demo Mode',
        'Referral invitations are read-only in the sandbox. No email will be sent.',
      );
      return;
    }
    if (!email.trim()) {
      Alert.alert('Validation', 'Enter email');
      return;
    }

    if (!clubInfo?.canInvite) {
      Alert.alert(
        'Invitation not available',
        'Invitations are unavailable under your current account terms.',
      );
      return;
    }

    setSending(true);
    try {
      const {data} = await api.post('/referrals/invite', {email: email.trim()}, localRequestUI);

      Alert.alert('Invite sent', `Code: ${data.code}\nLink:\n${data.link}`);

      setEmail('');
      await loadInvites();
    } catch (e: any) {
      console.error(e);
      let msg = 'Failed to send invite';
      if (e?.response?.data?.message) msg = e.response.data.message;
      Alert.alert('Error', msg);
    } finally {
      setSending(false);
    }
  };

  const rewardText = useMemo(() => {
    if (!clubInfo) {
      return 'Referral bonus size and duration depend on your status.';
    }

    return `Your reward terms: ${clubPercent(
      clubInfo.referrerRewardPercent,
    )} for ${
      clubInfo.referrerRewardYears
    } years. These are conditions, not earned rewards.`;
  }, [clubInfo]);

  const friendBenefitText = useMemo(() => {
    if (!clubInfo) {
      return 'Your friend gets a reduced marketplace fee.';
    }

    return `Your current marketplace fee terms: ${clubPercent(
      clubInfo.baseFee,
    )} standard / ${clubPercent(
      clubInfo.withReferralFee,
    )} with referral. Your friend’s terms depend on their own account.`;
  }, [clubInfo]);

  const renderHistoryItem = ({item}: {item: InviteRow}) => {
    const meta = getInviteStatusMeta(item);

    return (
      <View style={styles.historyRow}>
        <View style={styles.historyAvatar}>
          <Text style={styles.historyAvatarText}>
            {getInitials(item.inviteeEmail)}
          </Text>
        </View>

        <View style={styles.historyContent}>
          <Text style={styles.historyEmail}>{item.inviteeEmail}</Text>
          <Text
            style={[
              styles.historyMeta,
              meta.kind === 'failed' && styles.historyMetaFailed,
            ]}>
            {meta.text}
          </Text>
        </View>

        <View
          style={[styles.historyStatusCircle, {backgroundColor: meta.color}]}>
          <Ionicons name={meta.icon as any} size={14} color="#FFFFFF" />
        </View>
      </View>
    );
  };

  if (loading) return <ScreenLoader />;
  if (loadError)
    return <ErrorState title="Unable to load referrals" onRetry={loadAll} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Image
          source={require('../assets/images/freepik__3d1.png')}
          style={styles.heroImage}
          resizeMode="contain"
        />

        <Text style={styles.heroTitle}>
          Invite friends{'\n'}and earn bonuses
        </Text>

        <Text style={styles.heroText}>{rewardText}</Text>
        <Text style={styles.heroTextSecondary}>{friendBenefitText}</Text>

        {!clubInfo?.canInvite && (
          <Text style={styles.blockedText}>
            Invitations are unavailable under your current account terms.
          </Text>
        )}

        {isDemo && (
          <Text style={styles.blockedText}>
            Demo Mode: referral history is read-only and invitations are not
            sent.
          </Text>
        )}

        <StyledInput
          style={styles.input}
          placeholder="Friend’s Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.heroTextSecondary}>
          Creating an invitation costs $10 and sends an email. Review the
          address before sending.
        </Text>
        <BlueButton
          title={sending ? 'Sending...' : 'Send Invite'}
          onPress={sendInvite}
          disabled={isDemo || sending || !clubInfo?.canInvite}
          width="full"
          showArrow={false}
          bgColor="#098653"
          textColor="#FFFFFF"
          borderColor="#098653"
          paddingVertical={13}
          style={styles.sendButton}
        />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>How it works</Text>

        <HowItWorksItem title="Send your referral link to a friend" />
        <HowItWorksItem title="Friend registers" />
        <HowItWorksItem title="Friend completes the referral conditions" />
        <HowItWorksItem
          title="You earn a commission on their net profit – percentage and duration depend on your status"
          isLast
          done
        />
      </View>

      <View style={styles.historyCard}>
        <Text style={styles.sectionTitle}>Invitation history</Text>

        {list.length === 0 ? (
          <Text style={styles.emptyText}>You haven't invited anyone yet.</Text>
        ) : (
          <FlatList
            data={list}
            keyExtractor={x => x.id}
            renderItem={renderHistoryItem}
            scrollEnabled={false}
            ItemSeparatorComponent={() => (
              <View style={styles.historyDivider} />
            )}
            contentContainerStyle={{paddingTop: 8}}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f7f3',
  },

  content: {
    padding: 16,
    paddingBottom: 120,
  },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
    marginBottom: 16,
    alignItems: 'center',
  },

  heroImage: {
    width: '100%',
    height: 140,
    marginBottom: 10,
  },

  heroTitle: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '700',
    color: '#098653',
    textAlign: 'center',
    marginBottom: 14,
  },

  heroText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#222222',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
  },

  heroTextSecondary: {
    fontSize: 14,
    lineHeight: 21,
    color: '#222222',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
  },

  blockedText: {
    color: '#E11D48',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },

  input: {
    width: '100%',
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 0,
    backgroundColor: '#F5F5F5',
  },

  sendButton: {
    width: '100%',
    marginBottom: 0,
    borderRadius: 14,
    shadowOpacity: 0,
    elevation: 0,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    marginBottom: 16,
  },

  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 14,
  },

  howRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 58,
  },

  howLeft: {
    width: 24,
    alignItems: 'center',
    marginRight: 10,
  },

  howDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#098653',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  howDotDone: {
    backgroundColor: '#098653',
    borderColor: '#098653',
  },

  howDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },

  howLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: '#A7E3C8',
    marginTop: 4,
    marginBottom: -4,
  },

  howText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#222222',
    paddingBottom: 12,
  },

  emptyText: {
    fontSize: 14,
    color: '#9A9A9A',
    marginTop: 8,
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  historyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7BCDB0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  historyAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
  },

  historyContent: {
    flex: 1,
    paddingRight: 10,
  },

  historyEmail: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222222',
    marginBottom: 3,
  },

  historyMeta: {
    fontSize: 12,
    color: '#9A9A9A',
    lineHeight: 18,
  },

  historyMetaFailed: {
    color: '#E11D48',
  },

  historyStatusCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyDivider: {
    height: 1,
    backgroundColor: '#ECEEF2',
    marginLeft: 56,
  },
});
