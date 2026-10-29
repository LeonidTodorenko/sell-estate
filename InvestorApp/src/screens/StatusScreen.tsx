import React, {useCallback, useState} from 'react';
import {View, Text, ScrollView, StyleSheet, RefreshControl} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useFocusEffect} from '@react-navigation/native';
import api from '../api';
import theme from '../constants/theme';
import ErrorState from '../components/ErrorState';
import ScreenLoader from '../components/ScreenLoader';

type ClubInfo = {
  status?: string;
  totalAssets?: number;
  baseFee?: number;
  withReferralFee?: number;
  canInvite?: boolean;
  referrerRewardPercent?: number;
  referrerRewardYears?: number;
};
type Assets = {clubFeePercent?: number; hasReferrer?: boolean};
import {clubPercent} from '../utils/clubDisplay';
export {clubPercent} from '../utils/clubDisplay';
const tones: Record<string, string> = {
  Explorer: '#e4ecef',
  Expert: '#e9e5f5',
  Visionary: '#d9f0e5',
  VIP: '#18382c',
};
export default function StatusScreen() {
  const [data, setData] = useState<ClubInfo | null>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [partial, setPartial] = useState(false);
  const load = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true);
    setError(false);
    setPartial(false);
    try {
      const raw = await AsyncStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      const id = user?.userId ?? user?.id ?? user?.user?.id;
      if (!id) throw new Error('Session unavailable');
      const [clubResult, assetsResult] = await Promise.allSettled([
        api.get(`/share-offers/${id}/club-info`, {
          silentLoading: true,
          silentError: true,
        } as any),
        api.get(`/users/${id}/total-assets`, {
          silentLoading: true,
          silentError: true,
        } as any),
      ]);
      if (!isActive()) return;
      if (clubResult.status === 'rejected') throw clubResult.reason;
      setData(clubResult.value.data ?? null);
      setAssets(
        assetsResult.status === 'fulfilled' ? assetsResult.value.data : null,
      );
      setPartial(assetsResult.status === 'rejected');
    } catch (_) {
      if (isActive()) {
        setData(null);
        setAssets(null);
        setError(true);
      }
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void load(() => active);
      return () => {
        active = false;
      };
    }, [load]),
  );
  if (loading && !data) return <ScreenLoader />;
  if (error)
    return (
      <ErrorState
        title="Unable to load Club status"
        onRetry={() => {
          void load();
        }}
        isRetrying={loading}
      />
    );
  if (!data)
    return (
      <ErrorState
        title="Club status unavailable"
        description="No membership details were returned."
        onRetry={() => {
          void load();
        }}
      />
    );
  const dark = data.status === 'VIP';
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {
            void load();
          }}
        />
      }>
      <Text style={styles.eyebrow}>OWNERSCLUB</Text>
      <Text style={styles.title}>Club status</Text>
      <Text style={styles.description}>
        Your membership and marketplace profit fees.
      </Text>
      <View
        style={[
          styles.hero,
          {backgroundColor: tones[data.status ?? ''] ?? theme.colors.surface},
        ]}>
        <Text style={[styles.label, dark && styles.light]}>
          Your current status
        </Text>
        <Text style={[styles.status, dark && styles.light]}>
          {data.status || 'Unavailable'}
        </Text>
        <Text style={[styles.label, dark && styles.light]}>Total assets</Text>
        <Text style={[styles.value, dark && styles.light]}>
          {typeof data.totalAssets === 'number' &&
          Number.isFinite(data.totalAssets)
            ? `$${data.totalAssets.toLocaleString('en-US', {
                maximumFractionDigits: 2,
              })}`
            : 'Unavailable'}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Marketplace fees</Text>
        <Text style={styles.description}>
          Fees apply to marketplace profit.
        </Text>
        <Metric label="Standard fee" value={clubPercent(data.baseFee)} />
        <Metric
          label="With a referral"
          value={clubPercent(data.withReferralFee)}
        />
        <Metric
          label="Your applied fee"
          value={clubPercent(assets?.clubFeePercent)}
        />
        {partial && (
          <Text accessibilityRole="alert" style={styles.note}>
            Applied fee could not be loaded. Pull down to retry.
          </Text>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Referral conditions</Text>
        <Metric
          label="Invitations"
          value={
            data.canInvite === true
              ? 'Available'
              : data.canInvite === false
              ? 'Unavailable'
              : 'Unknown'
          }
        />
        <Metric
          label="Reward rate"
          value={clubPercent(data.referrerRewardPercent)}
        />
        <Metric
          label="Reward duration"
          value={
            typeof data.referrerRewardYears === 'number'
              ? `${data.referrerRewardYears} years`
              : 'Unavailable'
          }
        />
        <Text style={styles.note}>
          These are your current terms, not rewards already earned.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Membership levels</Text>
        <Text style={styles.description}>
          Explorer · Expert · Visionary · VIP
        </Text>
        <Text style={styles.note}>
          Your level is assigned by the service. Level thresholds and next-level
          progress are not supplied by the current API.
        </Text>
      </View>
    </ScrollView>
  );
}
function Metric({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.metric}>{value}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: theme.colors.background},
  content: {padding: 16, paddingBottom: 120, gap: 16},
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {fontSize: 28, fontWeight: '700', color: theme.colors.text},
  description: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  hero: {padding: 24, borderRadius: 18, gap: 8},
  status: {fontSize: 32, fontWeight: '700', color: theme.colors.text},
  value: {fontSize: 24, fontWeight: '600', color: theme.colors.text},
  light: {color: '#fff'},
  card: {
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    gap: 12,
  },
  heading: {fontSize: 18, fontWeight: '600', color: theme.colors.text},
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {color: theme.colors.textSecondary, fontSize: 14, flexShrink: 1},
  metric: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flexShrink: 1,
  },
  note: {fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary},
});
