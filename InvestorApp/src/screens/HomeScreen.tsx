import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Image,
  Dimensions,
  ImageSourcePropType,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import BlueButton from '../components/BlueButton';
import { useQueryClient } from '@tanstack/react-query';
import { fetchPropertiesWithExtras, Property } from '../services/properties';
import { useFocusEffect } from '@react-navigation/native';
import theme from '../constants/theme';
import { LineChart } from 'react-native-chart-kit';

import inboxIcon from '../assets/images/inbox_icon.png';
import historyIcon from '../assets/images/history_icon.png';

import walletIcon from '../assets/images/wallet.png';
import investmentIcon from '../assets/images/investment.png';
import rentalIcon from '../assets/images/rental.png';
import transitIcon from '../assets/images/transit.png';
import shareIcon from '../assets/images/share.png';
import timeCircleIcon from '../assets/images/timecircle.png';
import growthIcon from '../assets/images/Vector.png';
import upIcon from '../assets/images/Up.png';
import plusIcon from '../assets/images/Plus.png';

type ShareOffer = {
  id: string;
  sellerId: string;
  propertyId: string;
  propertyTitle: string;
  sharesForSale: number;
  isActive: boolean;
  expirationDate: string;
  startPricePerShare?: number;
  buyoutPricePerShare?: number | null;
};

type HomeMarketCard = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  location?: string;
  sharesForSale: number;
  startPricePerShare: number;
  buyoutPricePerShare?: number | null;
  expirationDate: string;
  preview?: string | null;
  bidsCount: number;
}; 

type Totals = {
  walletBalance: number;
  investmentValue: number;
  pendingApplicationsValue: number;
  marketValue: number;
  rentalIncome: number;
  totalAssets: number;
};

type Investment = {
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
};

type PropertyImage = {
  id: string;
  base64Data: string;
};

type HistoryPoint = {
  date: string;
  total: number;
};

type AssetStats = {
  walletBalance: number;
  investmentValue: number;
  totalAssets: number;
  rentalIncome: number;
  equityHistory: HistoryPoint[];
  rentIncomeHistory: HistoryPoint[];
  combinedHistory: HistoryPoint[];
  clubStatus?: string;
  hasReferrer?: boolean;
  clubFeePercent?: number;
  baseFeePercent?: number;
  referralFeePercent?: number;
};

type ClubInfo = {
  totalAssets: number;
  status: 'Explorer' | 'Expert' | 'Visionary' | 'VIP' | string;
  baseFee?: number;
  withReferralFee?: number;
  canInvite?: boolean;
  referrerRewardPercent?: number;
  referrerRewardYears?: number;
};

function money(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatLabel(dateStr: string) {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

function getPropertyPreview(item: Property): string | null {
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

function getClubBadge(status?: string) {
  switch (status) {
    case 'Explorer':
      return { text: 'EP', bg: '#60A5FA', textColor: '#FFFFFF', label: 'Explorer' };
    case 'Expert':
      return { text: 'EX', bg: '#C0C6D4', textColor: '#1F2937', label: 'Expert' };
    case 'Visionary':
      return { text: 'VS', bg: '#D4A73D', textColor: '#111827', label: 'Visionary' };
    case 'VIP':
      return { text: 'VI', bg: '#6EE7D8', textColor: '#111827', label: 'VIP' };
    default:
      return { text: 'EP', bg: '#60A5FA', textColor: '#FFFFFF', label: 'Explorer' };
  }
}

const Row = ({
  label,
  value,
  iconSource,
}: {
  label: string;
  value: string;
  iconSource?: ImageSourcePropType;
}) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>
      {!!iconSource && <Image source={iconSource} style={styles.rowIcon} resizeMode="contain" />}
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const HeaderAction = ({
  iconSource,
  badge,
  onPress,
}: {
  iconSource: any;
  badge?: number;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.85 }]}>
    <Image source={iconSource} style={styles.headerActionIcon} resizeMode="contain" />

    {!!badge && badge > 0 && (
      <View style={styles.headerBadge}>
        <Text style={styles.headerBadgeText}>{badge > 99 ? '99+' : badge}</Text>
      </View>
    )}
  </Pressable>
);

const SectionHeader = ({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: () => void;
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {!!onSeeAll && (
      <Pressable onPress={onSeeAll}>
        <Text style={styles.seeAll}>See all</Text>
      </Pressable>
    )}
  </View>
);

const ListingCard = ({
  item,
  onPress,
}: {
  item: HomeMarketCard;
  onPress: () => void;
}) => {
  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.listingCard, pressed && { opacity: 0.94 }]}
    >
      <View style={styles.listingTopRow}>
        <View style={styles.listingTopLeft}>
          {item.preview ? (
            <Image source={{ uri: item.preview }} style={styles.listingThumb} />
          ) : (
            <View style={[styles.listingThumb, styles.imageFallback]}>
              <Text style={styles.imageFallbackText}>No</Text>
            </View>
          )}

          <View style={styles.listingTitleWrap}>
            <Text style={styles.listingTitle} numberOfLines={1}>
              {item.propertyTitle}
            </Text>
            <Text style={styles.listingSubtitle} numberOfLines={1}>
              {item.location || 'Dubai'}
            </Text>
          </View>
        </View>

        <View style={styles.listingPriceWrap}>
          <Text style={styles.listingPrice}>
            {money(item.startPricePerShare ?? 0)}
          </Text>
          <Text style={styles.listingPriceCaption}>per share</Text>
        </View>
      </View>

      <View style={styles.listingInfoGrid}>
        <View style={styles.listingInfoCol}>
          <Text style={styles.listingInfoLabel}>Buyout price</Text>
          <Text style={styles.listingInfoValue}>
            {item.buyoutPricePerShare != null ? money(item.buyoutPricePerShare) : '—'}
          </Text>
        </View>

        <View style={styles.listingInfoColRight}>
          <Text style={styles.listingInfoLabel}>Offers</Text>
          <Text style={styles.listingInfoValue}>{item.bidsCount}</Text>
        </View>
      </View>

     <View style={styles.listingMetaRow}>
      <View style={styles.listingSharesWrap}>
        <Image source={shareIcon} style={styles.listingMetaIcon} resizeMode="contain" />
        <Text style={styles.listingMetaInline}>{item.sharesForSale} shares</Text>
      </View>

      <View style={styles.listingDaysWrap}>
        <Image source={timeCircleIcon} style={styles.listingDaysIcon} resizeMode="contain" />
        <Text style={styles.listingDaysLeft}>{daysLeft} days left</Text>
      </View>
    </View>

      <View style={styles.listingBottomRow}>
        <BlueButton
          title="More details"
          onPress={onPress}
          showArrow={false}
          bgColor="#111827"
          textColor={theme.colors.white}
          borderColor="#111827"
          paddingVertical={8}
          paddingHorizontal={8}
          style={styles.listingDetailsButton}
        />
      </View>
    </Pressable>
  );
};

const InvestmentRow = ({
  item,
  imageUri,
  onPress,
  isLast,
}: {
  item: Investment;
  imageUri?: string | null;
  onPress: () => void;
  isLast: boolean;
}) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.investmentRow, pressed && { opacity: 0.9 }]}>
    <View style={styles.investmentRowLeft}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.investmentRowImage} />
      ) : (
        <View style={[styles.investmentRowImage, styles.imageFallback]}>
          <Text style={styles.imageFallbackText}>No</Text>
        </View>
      )}

      <View style={styles.investmentRowTextWrap}>
        <Text style={styles.investmentRowTitle} numberOfLines={1}>
          {item.propertyTitle}
        </Text>
        <Text style={styles.investmentRowSubtitle}>
          {item.totalShares} shares
        </Text>
      </View>
    </View>

    <View style={styles.investmentRowRight}>
      <Text style={styles.investmentRowAmount}>{money(item.totalShareValue ?? 0)}</Text>
      {!!item.monthlyRentalIncome && item.monthlyRentalIncome > 0 ? (
          <View style={styles.investmentProfitWrap}>
            <Image source={growthIcon} style={styles.investmentProfitIcon} resizeMode="contain" />
            <Text style={styles.investmentRowProfit}>+ {money(item.monthlyRentalIncome)}</Text>
          </View>
        ) : (
          <Text style={styles.investmentRowMuted}>—</Text>
        )}
    </View>

    {!isLast && <View style={styles.investmentDivider} />}
  </Pressable>
);

export default function MainHomeScreen({ navigation }: any) {
  const [userFullName, setUserFullName] = useState<string>('');
  const [totals, setTotals] = useState<Totals | null>(null);
  const [unread, setUnread] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  //const [activeListings, setActiveListings] = useState<Property[]>([]);
  const [marketListings, setMarketListings] = useState<HomeMarketCard[]>([]);
  const [myInvestments, setMyInvestments] = useState<Investment[]>([]);
  const [investmentImagesMap, setInvestmentImagesMap] = useState<Record<string, PropertyImage[]>>({});
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [chartRange, setChartRange] = useState<'3m' | '6m' | '1y' | 'all'>('1y');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  

  const load = useCallback(async () => {
    const stored = await AsyncStorage.getItem('user');
    if (!stored) return;

    const u = JSON.parse(stored);
    setUserFullName(u.fullName || '');
    setUserAvatar(u.avatarBase64 || u.AvatarBase64 || null);

   const [assetsRes, unreadRes, propertiesRes, investmentsRes, statsRes, clubInfoRes, offersRes] = await Promise.all([
  api.get(`/users/${u.userId}/total-assets`),
  api.get(`/messages/unread-count/${u.userId}`).catch(() => ({ data: { count: 0 } })),
  fetchPropertiesWithExtras(20).catch(() => []),
  api.get(`/investments/with-aggregated/${u.userId}`).catch(() => ({ data: [] })),
  api.get(`/users/${u.userId}/assets-summary`).catch(() => ({ data: null })),
  api.get(`/share-offers/${u.userId}/club-info`).catch(() => ({ data: null })),
  api.get(`/share-offers/active`).catch(() => ({ data: [] })),
]);

    const a = assetsRes.data;
    setTotals({
      walletBalance: a.walletBalance ?? 0,
      investmentValue: a.investmentValue ?? 0,
      pendingApplicationsValue: a.pendingApplicationsValue ?? 0,
      marketValue: a.marketValue ?? 0,
      rentalIncome: a.rentalIncome ?? 0,
      totalAssets: a.totalAssets ?? (a.walletBalance ?? 0) + (a.investmentValue ?? 0),
    });

    setUnread(unreadRes?.data?.count ?? 0);
    setStats(statsRes?.data ?? null);
    setClubInfo(clubInfoRes?.data ?? null);

    // const preparedListings = (propertiesRes ?? [])
    //   .filter((p: Property) => (p.availableShares ?? 0) > 0)
    //   .slice(0, 5);

    // setActiveListings(preparedListings);

    const propertiesById = new Map<string, Property>();
(propertiesRes ?? []).forEach((p: Property) => {
  propertiesById.set(p.id, p);
});

const rawOffers: ShareOffer[] = (offersRes?.data ?? [])
  .filter((o: ShareOffer) => o.isActive);

const topOffers = rawOffers.slice(0, 5);

// подтягиваем количество бидов для карточек
const bidsCountsEntries = await Promise.all(
  topOffers.map(async (offer) => {
    try {
      const res = await api.get(`/share-offers/${offer.id}/bids`);
      return [offer.id, Array.isArray(res.data) ? res.data.length : 0] as const;
    } catch {
      return [offer.id, 0] as const;
    }
  })
);

const bidsCountsMap = Object.fromEntries(bidsCountsEntries);

const preparedMarketListings: HomeMarketCard[] = topOffers.map((offer) => {
  const property = propertiesById.get(offer.propertyId);

  return {
    id: offer.id,
    propertyId: offer.propertyId,
    propertyTitle: offer.propertyTitle,
    location: property?.location ?? '',
    sharesForSale: offer.sharesForSale,
    startPricePerShare: offer.startPricePerShare ?? 0,
    buyoutPricePerShare: offer.buyoutPricePerShare ?? null,
    expirationDate: offer.expirationDate,
    preview: property ? getPropertyPreview(property) : null,
    bidsCount: bidsCountsMap[offer.id] ?? 0,
  };
});

setMarketListings(preparedMarketListings);


    const investments: Investment[] = (investmentsRes?.data ?? []).slice(0, 5);
    setMyInvestments(investments);

    const imagesResult: Record<string, PropertyImage[]> = {};
    await Promise.all(
      investments.map(async (inv) => {
        try {
          const res = await api.get(`/properties/${inv.propertyId}/images`);
          imagesResult[inv.propertyId] = res.data ?? [];
        } catch {
          imagesResult[inv.propertyId] = [];
        }
      })
    );
    setInvestmentImagesMap(imagesResult);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const qc = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      qc.prefetchQuery({
        queryKey: ['properties', 'withExtras'],
        queryFn: () => fetchPropertiesWithExtras(8),
      });
    }, [qc])
  );

  function filterHistoryByRange(points: HistoryPoint[], range: '3m' | '6m' | '1y' | 'all') {
  if (!points?.length || range === 'all') return points;

  const now = new Date();
  const from = new Date(now);

  if (range === '3m') from.setMonth(now.getMonth() - 3);
  if (range === '6m') from.setMonth(now.getMonth() - 6);
  if (range === '1y') from.setFullYear(now.getFullYear() - 1);

  return points.filter((p) => new Date(p.date) >= from);
}

  const monthlyHint = useMemo(() => {
    if (!totals) return '';
    const v = totals.rentalIncome ?? 0;
    if (v <= 0) return '';
    return `+ ${money(v)} per month`;
  }, [totals]);

  const combinedChart = useMemo(() => {
  if (!stats?.combinedHistory?.length) return null;

  const filteredHistory = filterHistoryByRange(stats.combinedHistory, chartRange);
  if (!filteredHistory.length) return null;

  const maxPoints = 6;

  let shortened =
    filteredHistory.length <= maxPoints
      ? filteredHistory
      : filteredHistory
          .filter((_, idx) => idx % Math.ceil(filteredHistory.length / maxPoints) === 0)
          .slice(0, maxPoints);

  if (shortened.length === 1) {
    shortened = [...shortened];
  }

  return {
    labels: shortened.map((p) => formatLabel(p.date)),
    datasets: [{ data: shortened.map((p) => p.total) }],
  };
}, [stats, chartRange]);

  const chartWidth = Dimensions.get('window').width - theme.spacing.lg * 2 - theme.spacing.md * 2;
  const badge = getClubBadge(clubInfo?.status);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroBlock}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeftWrap}>
          <View style={styles.clubBadgeCircle}>
            {userAvatar ? (
              <Image
                source={{ uri: userAvatar }}
                style={styles.userAvatarImage}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.clubBadgeFallback,
                  {
                    backgroundColor: badge.bg,
                  },
                ]}
              >
                <Text style={[styles.clubBadgeText, { color: badge.textColor }]}>
                  {badge.text}
                </Text>
              </View>
            )}
          </View>

            <View style={styles.headerLeft}>
             <Text style={styles.headerName}>Hi, {userFullName || 'User'}</Text>
  <Text style={styles.headerWelcome}>{badge.label}</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <HeaderAction
              iconSource={historyIcon}
              onPress={() => navigation.navigate('UserTransactions')}
            />

            <HeaderAction
              iconSource={inboxIcon}
              badge={unread}
              onPress={() => navigation.navigate('Inbox')}
            />
          </View>
        </View>

        <View style={styles.topCard}>
          <Text style={styles.topTitle}>Total Assets</Text>

          <Text style={styles.topAmount}>
            {totals ? money(totals.totalAssets) : '—'}
          </Text>

          {!!monthlyHint && <Text style={styles.topHint}>{monthlyHint}</Text>}

          <View style={{ height: theme.spacing.md }} />

          <View style={styles.breakdown}>
            <Row
              iconSource={walletIcon}
              label="Wallet balance"
              value={totals ? money(totals.walletBalance) : '—'}
            />
            <Row
              iconSource={investmentIcon}
              label="Investments value"
              value={totals ? money(totals.investmentValue) : '—'}
            />
            <Row
              iconSource={rentalIcon}
              label="Rental income"
              value={totals ? money(totals.rentalIncome) : '—'}
            />
            <Row
              iconSource={transitIcon}
              label="In transit"
              value={totals ? money(totals.pendingApplicationsValue) : '—'}
            />
          </View>

          <View style={{ height: theme.spacing.md }} />

        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => navigation.navigate('Withdraw')}
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonDark,
              { marginRight: theme.spacing.sm },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Image source={upIcon} style={styles.actionButtonIcon} resizeMode="contain" />
            <Text style={styles.actionButtonTextLight}>Withdraw</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('TopUp')}
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonLight,
              { marginLeft: theme.spacing.sm },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Image source={plusIcon} style={styles.actionButtonIcon} resizeMode="contain" />
            <Text style={styles.actionButtonTextDark}>Add Funds</Text>
          </Pressable>
        </View>


        </View>
      </View>

      <View style={{ height: theme.spacing.xl }} />

 <SectionHeader
  title="Active Listings"
  onSeeAll={() => navigation.navigate('ShareMarketplaces')}
/>

{marketListings.length > 0 ? (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.horizontalList}
  >
    {marketListings.map((item) => (
      <ListingCard
        key={item.id}
        item={item}
        onPress={() => navigation.navigate('ShareMarketplaces')}
      />
    ))}
  </ScrollView>
) : (
  <View style={styles.emptyCard}>
    <Text style={styles.emptyText}>No active listings yet</Text>
  </View>
)}

      <View style={{ height: theme.spacing.xl }} />

      <SectionHeader
        title="My Investment"
        onSeeAll={() => navigation.navigate('Investments')}
      />

      {myInvestments.length > 0 ? (
        <Pressable
          style={styles.myInvestmentCard}
          onPress={() => navigation.navigate('Investments')}
        >
          {myInvestments.map((item, index) => {
            const imageUri = investmentImagesMap[item.propertyId]?.[0]?.base64Data ?? null;

            return (
              <InvestmentRow
                key={item.propertyId}
                item={item}
                imageUri={imageUri}
                onPress={() => navigation.navigate('Investments')}
                isLast={index === myInvestments.length - 1}
              />
            );
          })}
        </Pressable>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No investments yet</Text>
        </View>
      )}

      <View style={{ height: theme.spacing.xl }} />

      <SectionHeader
        title="Portfolio dynamics"
        onSeeAll={() => navigation.navigate('MyFinance')}
      />

      {combinedChart ? (
        <View style={styles.chartCard}>
          <View style={styles.chartTopRow}>
            <View>
              <Text style={styles.chartCardTitle}>Overall Growth</Text>
              <Text style={styles.chartCardAmount}>
                {stats ? money(stats.totalAssets ?? 0) : '—'}
              </Text>
            </View>

            {!!totals?.rentalIncome && totals.rentalIncome > 0 && (
              <Text style={styles.chartIncomeHint}>
                + {money(totals.rentalIncome)} / month
              </Text>
            )}
          </View>

          <LineChart
            data={combinedChart}
            width={chartWidth}
            height={220}
            yAxisSuffix=" $"
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLines={false}
            fromZero={false}
            chartConfig={{
              backgroundColor: theme.colors.surface,
              backgroundGradientFrom: theme.colors.surface,
              backgroundGradientTo: theme.colors.surface,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(17, 163, 106, ${opacity})`,
              labelColor: () => theme.colors.textSecondary,
              propsForDots: {
                r: '3',
                strokeWidth: '1',
                stroke: theme.colors.primary,
              },
            }}
            bezier
            style={styles.chart}
          />
          <View style={styles.chartTabsRow}>
  <Pressable
    onPress={() => setChartRange('3m')}
    style={[styles.chartTab, chartRange === '3m' && styles.chartTabActive]}
  >
    <Text style={[styles.chartTabText, chartRange === '3m' && styles.chartTabTextActive]}>
      3 month
    </Text>
  </Pressable>

  <Pressable
    onPress={() => setChartRange('6m')}
    style={[styles.chartTab, chartRange === '6m' && styles.chartTabActive]}
  >
    <Text style={[styles.chartTabText, chartRange === '6m' && styles.chartTabTextActive]}>
      6 month
    </Text>
  </Pressable>

  <Pressable
    onPress={() => setChartRange('1y')}
    style={[styles.chartTab, chartRange === '1y' && styles.chartTabActive]}
  >
    <Text style={[styles.chartTabText, chartRange === '1y' && styles.chartTabTextActive]}>
      1 year
    </Text>
  </Pressable>

  <Pressable
    onPress={() => setChartRange('all')}
    style={[styles.chartTab, chartRange === 'all' && styles.chartTabActive]}
  >
    <Text style={[styles.chartTabText, chartRange === 'all' && styles.chartTabTextActive]}>
      All
    </Text>
  </Pressable>
</View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No chart data yet</Text>
        </View>
      )}

      <View style={{ height: theme.spacing.md }} />

      {/* <BlueButton
        title="All Statistics"
        onPress={() => navigation.navigate('MyFinance')}
        width="full"
        showArrow={false}
        bgColor="#F3F3F3"
        textColor={theme.colors.text}
        borderColor="#F3F4F6"
        paddingVertical={12}
        style={{
          shadowOpacity: 0,
          elevation: 0,
          borderRadius: 12,
        }}
      />

      <BlueButton
        title="Investments"
        onPress={() => navigation.navigate('Investments')}
        width="full"
        showArrow={false}
        bgColor="#F3F3F3"
        textColor={theme.colors.text}
        borderColor="#F3F4F6"
        paddingVertical={12}
        style={{
          shadowOpacity: 0,
          elevation: 0,
          borderRadius: 12,
        }}
      />

      <BlueButton
        title="Personal"
        onPress={() => navigation.navigate('Personal')}
        width="full"
        showArrow={false}
        bgColor="#F3F3F3"
        textColor={theme.colors.text}
        borderColor="#F3F4F6"
        paddingVertical={12}
        style={{
          shadowOpacity: 0,
          elevation: 0,
          borderRadius: 12,
        }}
      /> */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
  },

  heroBlock: {
    backgroundColor: '#14191D',
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    marginHorizontal: -theme.spacing.lg,
    marginTop: -theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },

  headerRow: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: theme.spacing.sm,
  },

 clubBadgeCircle: {
  width: 48,
  height: 48,
  borderRadius: 24,
  overflow: 'hidden',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: theme.spacing.md,
  backgroundColor: 'rgba(255,255,255,0.08)',
},
userAvatarImage: {
  width: '100%',
  height: '100%',
  borderRadius: 24,
},

clubBadgeFallback: {
  width: '100%',
  height: '100%',
  borderRadius: 24,
  alignItems: 'center',
  justifyContent: 'center',
},
  clubBadgeText: {
    fontSize: 16,
    fontWeight: '800',
  },

  headerLeft: {
    flex: 1,
  },

  headerWelcome: {
    fontSize: theme.typography.sizes.sm,
    color: '#A1A3A5',
    fontWeight: '600',
    marginTop: 2,
  },

  headerName: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '800',
    color: theme.colors.white,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },

  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
  },

  headerActionIcon: {
    width: 44,
    height: 44,
  },

  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '800',
  },

  topCard: {
    borderRadius: 28,
    padding: theme.spacing.lg,
    shadowOffset: { width: 0, height: 8 },
    elevation: 0,
  },

  topTitle: {
    color: '#A1A3A5',
    opacity: 0.85,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
  },

  topAmount: {
    color: theme.colors.white,
    fontSize: theme.typography.sizes.xxl,
    fontWeight: '800',
    marginTop: 4,
  },

  topHint: {
    color: theme.colors.success,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    marginTop: 4,
  },

  breakdown: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: theme.spacing.md,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },

  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: theme.spacing.md,
  },

  rowIcon: {
    width: 18,
    height: 18,
    marginRight: 8,
  },

  rowLabel: {
    color: theme.colors.white,
    opacity: 0.78,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
  },

  rowValue: {
    color: theme.colors.white,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  sectionHeader: {
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },

  seeAll: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.primary,
  },

  horizontalList: {
    paddingRight: theme.spacing.md,
    paddingLeft: 2,
  },

  listingCard: {
    width: 340,
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.md,
    padding: theme.spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  listingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  listingTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: theme.spacing.md,
  },

  listingThumb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginRight: theme.spacing.md,
    backgroundColor: '#DDE3EA',
  },

  listingTitleWrap: {
    flex: 1,
  },

  listingTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: theme.colors.text,
  },

  listingSubtitle: {
    marginTop: 3,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },

  listingPriceWrap: {
    alignItems: 'flex-end',
  },

  listingPrice: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '800',
    color: theme.colors.text,
  },

  listingPriceCaption: {
    marginTop: 2,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },

  listingInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },

  listingInfoCol: {
    flex: 1,
  },

  listingInfoColRight: {
    alignItems: 'flex-end',
    marginLeft: theme.spacing.md,
  },

  listingInfoLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },

  listingInfoValue: {
    marginTop: 3,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text,
    fontWeight: '700',
  },

  listingBottomRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  listingDetailsButton: {
    width: 142,
    marginBottom: 0,
    borderRadius: 18,
    shadowOpacity: 0,
    elevation: 0,
  },

  myInvestmentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  investmentRow: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },

  investmentRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: theme.spacing.md,
  },

  investmentRowImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: theme.spacing.md,
    backgroundColor: '#DDE3EA',
  },

  investmentRowTextWrap: {
    flex: 1,
  },

  investmentRowTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
  },

  investmentRowSubtitle: {
    marginTop: 2,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },

  investmentRowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  investmentRowAmount: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: theme.colors.text,
  },

  investmentRowProfit: {
    marginTop: 4,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.success,
  },

  investmentRowMuted: {
    marginTop: 4,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },

  investmentDivider: {
    position: 'absolute',
    left: 56,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },

  innerButton: {
    paddingLeft: 16,
    paddingRight: 16,
  },

  chartCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  chartTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },

  chartCardTitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },

  chartCardAmount: {
    marginTop: 4,
    fontSize: theme.typography.sizes.xl,
    color: theme.colors.text,
    fontWeight: '800',
  },

  chartIncomeHint: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.success,
    fontWeight: '700',
    marginLeft: theme.spacing.sm,
  },

  chart: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.radii.md,
  },

  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
  },

  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  imageFallbackText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  chartTabsRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: theme.spacing.md,
  gap: theme.spacing.sm,
},

chartTab: {
  flex: 1,
  backgroundColor: '#F3F3F3',
  borderRadius: 10,
  paddingVertical: 10,
  alignItems: 'center',
  justifyContent: 'center',
},

chartTabActive: {
  backgroundColor: '#111827',
},

chartTabText: {
  fontSize: theme.typography.sizes.sm,
  fontWeight: '600',
  color: theme.colors.text,
},

chartTabTextActive: {
  color: theme.colors.white,
},
listingMetaRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: theme.spacing.md,
},

listingSharesWrap: {
  flexDirection: 'row',
  alignItems: 'center',
},

listingMetaIcon: {
  width: 16,
  height: 16,
  marginRight: 6,
},

listingMetaInline: {
  fontSize: theme.typography.sizes.sm,
  color: theme.colors.textSecondary,
  fontWeight: '600',
},

listingDaysLeft: {
  fontSize: theme.typography.sizes.sm,
  color: theme.colors.success,
  fontWeight: '700',
},
actionButton: {
  flex: 1,
  height: 48,
  borderRadius: 16,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
},

actionButtonDark: {
  backgroundColor: '#3B3E48',
},

actionButtonLight: {
  backgroundColor: '#F3F4F6',
},

actionButtonIcon: {
  width: 18,
  height: 18,
  marginRight: 8,
},

actionButtonTextLight: {
  color: theme.colors.white,
  fontSize: theme.typography.sizes.md,
  fontWeight: '700',
},

actionButtonTextDark: {
  color: theme.colors.text,
  fontSize: theme.typography.sizes.md,
  fontWeight: '700',
},

listingDaysWrap: {
  flexDirection: 'row',
  alignItems: 'center',
},

listingDaysIcon: {
  width: 16,
  height: 16,
  marginRight: 6,
},

investmentProfitWrap: {
  marginTop: 4,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-end',
},

investmentProfitIcon: {
  width: 14,
  height: 14,
  marginRight: 5,
},
});