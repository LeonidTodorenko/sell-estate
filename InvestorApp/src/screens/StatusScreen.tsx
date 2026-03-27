import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api';
import theme from '../constants/theme';

type StatusName = 'Explorer' | 'Expert' | 'Visionary' | 'VIP';

type StatusConfig = {
  key: StatusName;
  minAssets: number;
  feePercent: number;
  title: string;
  description: string;
  screenBg: string;
  cardBg: string;
  darkCard?: boolean;
};

type UserStatusData = {
  totalAssets: number;
  clubStatus: StatusName;
  clubFeePercent: number | null;
  hasReferrer: boolean | null;
  baseFeePercent: number | null;
  referralFeePercent: number | null;
};

const LEVELS: StatusConfig[] = [
  {
    key: 'Explorer',
    minAssets: 0,
    feePercent: 9,
    title: 'Explorer',
    description:
      'Entry level for those who are just discovering the world of real estate investing.',
    screenBg: '#DCE5EC',
    cardBg: '#DCE5EC',
  },
  {
    key: 'Expert',
    minAssets: 50_000,
    feePercent: 7,
    title: 'Expert',
    description:
      'Level for experienced investors who already have a diversified portfolio.',
    screenBg: '#DDD9F2',
    cardBg: '#DDD9F2',
  },
  {
    key: 'Visionary',
    minAssets: 200_000,
    feePercent: 5,
    title: 'Visionary',
    description:
      'Level for those who look to the future and shape trends in the investment market.',
    screenBg: '#98E1C1',
    cardBg: '#98D8F2',
  },
  {
    key: 'VIP',
    minAssets: 500_000,
    feePercent: 3,
    title: 'VIP',
    description:
      'Highest level for investors with major capital and maximum marketplace benefits.',
    screenBg: '#022A22',
    cardBg: '#022A22',
    darkCard: true,
  },
];

function formatMoney(value: number) {
  return `$${value.toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function getLevelConfig(status: StatusName) {
  return LEVELS.find((x) => x.key === status) ?? LEVELS[0];
}

/**
 * Псевдо-градиентный бейдж без внешней библиотеки.
 * Для маленьких плашек выглядит достаточно похоже на макет.
 */
function FeeBadge({
  text,
  large = false,
}: {
  text: string;
  large?: boolean;
}) {
  return (
    <View style={[large ? styles.feeBadge : styles.smallFeeBadge]}>
      <View style={styles.badgeBase} />
      <View style={styles.badgeTopGlow} />
      <View style={styles.badgeBottomDark} />
      <Text style={large ? styles.feeBadgeText : styles.smallFeeBadgeText}>{text}</Text>
    </View>
  );
}

export default function StatusScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UserStatusData | null>(null);
  const sliderRef = useRef<FlatList>(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);

      const stored = await AsyncStorage.getItem('user');
      if (!stored) {
        setLoading(false);
        return;
      }

      const parsed = JSON.parse(stored);
      const userId = parsed.userId ?? parsed.id ?? parsed?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      const res = await api.get(`/users/${userId}/total-assets`);
      const status = (res.data.clubStatus ?? 'Explorer') as StatusName;

      setData({
        totalAssets: Number(res.data.totalAssets ?? 0),
        clubStatus: status,
        clubFeePercent:
          typeof res.data.clubFeePercent === 'number' ? res.data.clubFeePercent : null,
        hasReferrer:
          typeof res.data.hasReferrer === 'boolean' ? res.data.hasReferrer : null,
        baseFeePercent:
          typeof res.data.baseFeePercent === 'number' ? res.data.baseFeePercent : null,
        referralFeePercent:
          typeof res.data.referralFeePercent === 'number'
            ? res.data.referralFeePercent
            : null,
      });
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus]),
  );

  const currentLevel = useMemo(() => {
    return getLevelConfig(data?.clubStatus ?? 'Explorer');
  }, [data]);

  const currentIndex = useMemo(() => {
    return LEVELS.findIndex((x) => x.key === currentLevel.key);
  }, [currentLevel]);

  const nextLevel = useMemo(() => {
    if (currentIndex < 0 || currentIndex === LEVELS.length - 1) return null;
    return LEVELS[currentIndex + 1];
  }, [currentIndex]);

  const progressPercent = useMemo(() => {
    if (!data) return 0;
    if (!nextLevel) return 100;

    const currentMin = currentLevel.minAssets;
    const nextMin = nextLevel.minAssets;
    const range = nextMin - currentMin;
    const done = data.totalAssets - currentMin;

    if (range <= 0) return 100;
    return clamp((done / range) * 100, 0, 100);
  }, [data, currentLevel, nextLevel]);

  const amountToNext = useMemo(() => {
    if (!data || !nextLevel) return 0;
    return Math.max(0, nextLevel.minAssets - data.totalAssets);
  }, [data, nextLevel]);

  const feePercentText = useMemo(() => {
    if (!data) return `${currentLevel.feePercent}%`;

    if (typeof data.clubFeePercent === 'number') {
      return `${Math.round(data.clubFeePercent * 100)}%`;
    }

    return `${currentLevel.feePercent}%`;
  }, [data, currentLevel]);

  const isDarkHero = currentLevel.key === 'VIP';
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = screenWidth - 118;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.emptyText}>No status data</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentLevel.screenBg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroSection}>
          <Text
            style={[
              styles.heroLabel,
              { color: isDarkHero ? 'rgba(255,255,255,0.62)' : '#7A7A84' },
            ]}
          >
            Your current status
          </Text>

          <View style={styles.heroTitleRow}>
            <Text
              style={[
                styles.heroTitle,
                { color: isDarkHero ? '#FFFFFF' : '#171717' },
              ]}
            >
              {currentLevel.title}
            </Text>

            <FeeBadge text={`Fee ${feePercentText}`} large />
          </View>

          {nextLevel ? (
            <>
              <Text
                style={[
                  styles.progressPercent,
                  { color: isDarkHero ? '#FFFFFF' : '#171717' },
                ]}
              >
                {Math.round(progressPercent)}%
              </Text>

              <View
                style={[
                  styles.progressTrack,
                  {
                    backgroundColor: isDarkHero
                      ? 'rgba(255,255,255,0.18)'
                      : 'rgba(0,0,0,0.08)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercent}%` },
                  ]}
                />
              </View>

              <View style={styles.assetsRowInline}>
                <View style={styles.inlineInfoRow}>
                  <Text
                    style={[
                      styles.inlineInfoLabel,
                      { color: isDarkHero ? 'rgba(255,255,255,0.62)' : '#7A7A84' },
                    ]}
                  >
                    Current assets
                  </Text>
                  <Text
                    style={[
                      styles.inlineInfoValue,
                      { color: isDarkHero ? '#FFFFFF' : '#171717' },
                    ]}
                  >
                    {formatMoney(data.totalAssets)}
                  </Text>
                </View>

                <View style={[styles.inlineInfoRow, { marginTop: 10 }]}>
                  <Text
                    style={[
                      styles.inlineInfoLabel,
                      { color: isDarkHero ? 'rgba(255,255,255,0.62)' : '#7A7A84' },
                    ]}
                  >
                    To {nextLevel.title}
                  </Text>
                  <Text
                    style={[
                      styles.inlineInfoValue,
                      { color: isDarkHero ? '#FFFFFF' : '#171717' },
                    ]}
                  >
                    {formatMoney(amountToNext)}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.vipBlock}>
              <View style={styles.vipLeft}>
                <View style={styles.inlineInfoRow}>
                  <Text style={styles.inlineInfoLabelDark}>Your fee</Text>
                  <Text style={styles.inlineInfoValueDark}>{feePercentText}</Text>
                </View>

                <View style={[styles.inlineInfoRow, { marginTop: 10 }]}>
                  <Text style={styles.inlineInfoLabelDark}>Current assets</Text>
                  <Text style={styles.inlineInfoValueDark}>
                    {formatMoney(data.totalAssets)}
                  </Text>
                </View>
              </View>

              <View style={styles.vipRight}>
                <Text style={styles.vipText}>You've reached the highest level</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.levelsSheet}>
          <Text style={styles.levelsTitle}>All levels</Text>

          <FlatList
            ref={sliderRef}
            data={LEVELS}
            keyExtractor={(item) => item.key}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToAlignment="start"
            decelerationRate="fast"
            contentContainerStyle={styles.sliderContent}
            onLayout={() => {
              if (currentIndex > 0) {
                setTimeout(() => {
                  sliderRef.current?.scrollToIndex({
                    index: currentIndex,
                    animated: false,
                    viewPosition: 0.5,
                  });
                }, 50);
              }
            }}
            getItemLayout={(_, index) => ({
              length: cardWidth + 14,
              offset: (cardWidth + 14) * index,
              index,
            })}
            renderItem={({ item }) => {
              const isCurrent = item.key === currentLevel.key;
              const isDarkCard = !!item.darkCard;

              return (
                <View
                  style={[
                    styles.levelCard,
                    {
                      width: cardWidth,
                      backgroundColor: item.cardBg,
                    },
                  ]}
                >
                  <View style={styles.levelHeaderRow}>
                    <Text
                      style={[
                        styles.levelCardTitle,
                        { color: isDarkCard ? '#FFFFFF' : '#171717' },
                      ]}
                    >
                      {item.title}
                    </Text>

                    {isCurrent && (
                      <View style={styles.yourLevelBadge}>
                        <Text style={styles.yourLevelBadgeText}>Your level</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.levelFeeRow}>
                    <Text
                      style={[
                        styles.levelFrom,
                        { color: isDarkCard ? '#FFFFFF' : '#171717' },
                      ]}
                    >
                      From: {formatMoney(item.minAssets)}
                    </Text>

                    <FeeBadge text={`${item.feePercent}%`} />
                  </View>

                  <View
                    style={[
                      styles.levelDivider,
                      {
                        backgroundColor: isDarkCard
                          ? 'rgba(255,255,255,0.16)'
                          : 'rgba(0,0,0,0.08)',
                      },
                    ]}
                  />

                  <Text
                    style={[
                      styles.levelDescription,
                      {
                        color: isDarkCard
                          ? 'rgba(255,255,255,0.72)'
                          : 'rgba(23,23,23,0.55)',
                      },
                    ]}
                  >
                    {item.description}
                  </Text>
                </View>
              );
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingBottom: 120,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ECECEC',
  },

  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },

  heroSection: {
    paddingHorizontal: 22,
    paddingTop: 108,
    paddingBottom: 18,
  },

  heroLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 10,
  },

  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  heroTitle: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '400',
    marginRight: 10,
  },

  feeBadge: {
    minWidth: 92,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#3E3E3E',
  },

  smallFeeBadge: {
    minWidth: 46,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#3E3E3E',
  },

  badgeBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3E3E3E',
  },

  badgeTopGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '52%',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  badgeBottomDark: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },

  feeBadgeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    zIndex: 2,
  },

  smallFeeBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    zIndex: 2,
  },

  progressPercent: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },

  progressTrack: {
    width: '100%',
    height: 14,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 14,
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#25C58A',
  },

  assetsRowInline: {
    marginTop: 2,
  },

  inlineInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  inlineInfoLabel: {
    fontSize: 14,
    fontWeight: '400',
  },

  inlineInfoValue: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },

  vipBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 2,
  },

  vipLeft: {
    flex: 1,
    paddingRight: 16,
  },

  vipRight: {
    width: 128,
    alignItems: 'flex-end',
    paddingTop: 12,
  },

  inlineInfoLabelDark: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.62)',
  },

  inlineInfoValueDark: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginLeft: 12,
  },

  vipText: {
    textAlign: 'right',
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    lineHeight: 20,
  },

  levelsSheet: {
    backgroundColor: '#F4F4F4',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 18,
    paddingBottom: 28,
    minHeight: 620,
  },

  levelsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#171717',
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  sliderContent: {
    paddingLeft: 20,
    paddingRight: 8,
  },

  levelCard: {
    borderRadius: 24,
    padding: 16,
    marginRight: 14,
    height: 185,
    justifyContent: 'flex-start',
  },

  levelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  yourLevelBadge: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  yourLevelBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#171717',
  },

  levelCardTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },

  levelFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },

  levelFrom: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 10,
  },

  levelDivider: {
    height: 1,
    marginBottom: 14,
  },

  levelDescription: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
});