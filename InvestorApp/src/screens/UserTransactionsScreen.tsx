import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Alert,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import theme from '../constants/theme';
import { useNavigation } from '@react-navigation/native';

import icon1 from '../assets/images/history11.png';
import icon2 from '../assets/images/history12.png';
import icon3 from '../assets/images/history13.png';
import icon4 from '../assets/images/history14.png';
import icon5 from '../assets/images/history15.png';

interface UserTransaction {
  id: string;
  type: string;
  amount: number;
  shares?: number;
  propertyId?: string;
  propertyTitle?: string;
  timestamp: string;
  notes?: string;
}

type FilterValue =
  | ''
  | 'deposit'
  | 'withdrawal'
  | 'income'
  | 'buy'
  | 'sell';

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: 'All', value: '' },
  { label: 'Deposits', value: 'deposit' },
  { label: 'Withdrawals', value: 'withdrawal' },
  { label: 'Income', value: 'income' },
  { label: 'Buys', value: 'buy' },
  { label: 'Sales', value: 'sell' },
];

type TransactionSection = {
  title: string;
  data: UserTransaction[];
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatSectionTitle(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
  });
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(amount: number, positive: boolean) {
  const abs = Math.abs(amount);
  const formatted = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${positive ? '+' : '-'}$${formatted}`;
}

function normalizeFilter(tx: UserTransaction): FilterValue {
  const t = String(tx.type || '').toLowerCase();

  if (t === 'deposit') return 'deposit';
  if (t === 'withdrawal') return 'withdrawal';

  if (
    t === 'rentincome' ||
    t === 'rent_income' ||
    t === 'rental_income' ||
    t === 'referralreward' ||
    t === 'referral_reward' ||
    t === 'referralbonus' ||
    t === 'referral_bonus' ||
    t === 'clubfeeincome' ||
    t === 'club_fee_income'
  ) {
    return 'income';
  }

  if (
    t === 'investment' ||
    t === 'buyback' ||
    t === 'share_market_buy' ||
    t === 'sharemarketbuy' ||
    t.includes('buy')
  ) {
    return 'buy';
  }

  if (
    t === 'share_market_sell' ||
    t === 'sharemarketsell' ||
    t.includes('sell')
  ) {
    return 'sell';
  }

  return '';
}

function getTitle(item: UserTransaction) {
  const t = String(item.type || '').toLowerCase();

  if (t === 'deposit') return 'Deposit';
  if (t === 'withdrawal') return 'Withdrawal';
  if (t === 'investment') return 'Share Purchase';
  if (t === 'buyback') return 'Buyback';
  if (t === 'share_market_buy' || t === 'sharemarketbuy') return 'Marketplace Buy';
  if (t === 'share_market_sell' || t === 'sharemarketsell') return 'Marketplace Sale';
  if (t === 'rentincome' || t === 'rent_income' || t === 'rental_income') return 'Rental Income';
  if (
    t === 'referralreward' ||
    t === 'referral_reward' ||
    t === 'referralbonus' ||
    t === 'referral_bonus'
  ) {
    return 'Referral Bonus';
  }

  return item.type;
}

function getSubtitle(item: UserTransaction) {
  const t = String(item.type || '').toLowerCase();

  if (
    t === 'investment' ||
    t === 'buyback' ||
    t === 'share_market_buy' ||
    t === 'sharemarketbuy' ||
    t === 'share_market_sell' ||
    t === 'sharemarketsell'
  ) {
    if (item.propertyTitle && item.shares != null) {
      return `${item.propertyTitle} · ${item.shares} shares`;
    }
    if (item.propertyTitle) return item.propertyTitle;
    if (item.shares != null) return `${item.shares} shares`;
  }

  if (
    t === 'rentincome' ||
    t === 'rent_income' ||
    t === 'rental_income'
  ) {
    return item.propertyTitle || '';
  }

  return item.notes || item.propertyTitle || '';
}

function isPositiveTransaction(item: UserTransaction) {
  const t = String(item.type || '').toLowerCase();

  if (t === 'withdrawal') return false;
  if (t === 'investment') return false;
  if (t === 'share_market_buy' || t === 'sharemarketbuy') return false;

  if (item.amount < 0) return false;
  return true;
}

function getIcon(type: string) {
  const t = String(type || '').toLowerCase();

  if (t === 'deposit') return icon2;
  if (t === 'withdrawal') return icon2;

  if (t === 'rentincome' || t === 'rent_income' || t === 'rental_income') {
    return icon5;
  }

  if (
    t === 'referralreward' ||
    t === 'referral_reward' ||
    t === 'referralbonus' ||
    t === 'referral_bonus'
  ) {
    return icon5;
  }

  if (
    t === 'investment' ||
    t === 'buyback' ||
    t === 'share_market_buy' ||
    t === 'sharemarketbuy' ||
    t === 'share_market_sell' ||
    t === 'sharemarketsell'
  ) {
    return icon3;
  }

  if (t.includes('income') || t.includes('referral')) return icon5;
  if (t.includes('buy') || t.includes('sell')) return icon3;

  return icon4;
}

export default function UserTransactionsScreen() {
  const navigation = useNavigation<any>();

  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterValue>('');

  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [dateMode, setDateMode] = useState<'from' | 'to' | null>(null);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);

      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;

      const user = JSON.parse(stored);

      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate.toISOString());
      if (toDate) params.append('to', toDate.toISOString());

      const res = await api.get(
        `/users/transactions/user/${user.userId}?${params.toString()}`
      );

      setTransactions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredTransactions = useMemo(() => {
    if (!activeFilter) return transactions;
    return transactions.filter((tx) => normalizeFilter(tx) === activeFilter);
  }, [transactions, activeFilter]);

  const sections = useMemo<TransactionSection[]>(() => {
    const groups: Record<string, UserTransaction[]> = {};

    filteredTransactions
      .slice()
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .forEach((item) => {
        const key = new Date(item.timestamp).toDateString();
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });

    return Object.values(groups).map((group) => ({
      title: formatSectionTitle(group[0].timestamp),
      data: group,
    }));
  }, [filteredTransactions]);

  const handleConfirmDate = (date: Date) => {
    setDatePickerVisible(false);
    if (dateMode === 'from') setFromDate(date);
    if (dateMode === 'to') setToDate(date);
  };

  const clearDates = () => {
    setFromDate(null);
    setToDate(null);
  };

  return (
    <View style={styles.screen}>
      {/* <View style={styles.topHeader}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>

        <Text style={styles.topHeaderTitle}>Transaction History</Text>

        <View style={styles.backButtonPlaceholder} />
      </View> */}

      <View style={styles.body}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {FILTERS.map((filter) => {
            const active = activeFilter === filter.value;

            return (
              <Pressable
                key={filter.value || 'all'}
                onPress={() => setActiveFilter(filter.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.dateFiltersRow}>
          <Pressable
            style={styles.dateChip}
            onPress={() => {
              setDateMode('from');
              setDatePickerVisible(true);
            }}
          >
            <Text style={styles.dateChipText}>
              {fromDate ? `From ${fromDate.toLocaleDateString()}` : 'From date'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.dateChip}
            onPress={() => {
              setDateMode('to');
              setDatePickerVisible(true);
            }}
          >
            <Text style={styles.dateChipText}>
              {toDate ? `To ${toDate.toLocaleDateString()}` : 'To date'}
            </Text>
          </Pressable>

          {(fromDate || toDate) && (
            <Pressable style={styles.clearChip} onPress={clearDates}>
              <Text style={styles.clearChipText}>Clear</Text>
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
            renderItem={({ item, index, section }) => {
              const positive = isPositiveTransaction(item);
              const title = getTitle(item);
              const subtitle = getSubtitle(item);
              const icon = getIcon(item.type);

              return (
                <View style={styles.itemRow}>
                  <View style={styles.itemLeft}>
                    <View style={styles.iconCircle}>
                      <Image source={icon} style={styles.itemIcon} resizeMode="contain" />
                    </View>

                    <View style={styles.textBlock}>
                      <Text style={styles.itemTitle}>{title}</Text>
                      {!!subtitle && (
                        <Text style={styles.itemSubtitle} numberOfLines={1}>
                          {subtitle}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.itemRight}>
                    <Text
                      style={[
                        styles.amount,
                        positive ? styles.amountPositive : styles.amountNegative,
                      ]}
                    >
                      {formatMoney(item.amount, positive)}
                    </Text>

                    <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
                  </View>

                  {index !== section.data.length - 1 && (
                    <View style={styles.itemDivider} />
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Image source={icon1} style={styles.emptyIcon} resizeMode="contain" />
                <Text style={styles.emptyText}>No transactions found</Text>
              </View>
            }
          />
        )}
      </View>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={() => setDatePickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },

  topHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButtonPlaceholder: {
    width: 36,
    height: 36,
  },

  backArrow: {
    fontSize: 28,
    lineHeight: 28,
    color: theme.colors.text,
  },

  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },

  body: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 14,
  },

  chipsScroll: {
    height: 60,
  },

  chipsRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },

  chip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginRight: 10,
  },

  chipActive: {
    backgroundColor: '#ECECEC',
  },

  chipText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },

  chipTextActive: {
    fontWeight: '600',
  },

  dateFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
    display:'none',
  },

  dateChip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  dateChipText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },

  clearChip: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  clearChipText: {
    fontSize: 14,
    color: theme.colors.danger,
    fontWeight: '600',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 36,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#A3A3A3',
    marginTop: 18,
    marginBottom: 14,
  },

  itemRow: {
    position: 'relative',
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },

  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },

  iconCircle: {
    // width: 52,
    // height: 52,
    // borderRadius: 26,
    // backgroundColor: '#EAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  itemIcon: {
    width: 52,
    height: 52,
  },

  textBlock: {
    flex: 1,
  },

  itemTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.colors.text,
  },

  itemSubtitle: {
    marginTop: 4,
    fontSize: 15,
    color: '#A3A3A3',
    fontWeight: '400',
  },

  itemRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  amount: {
    fontSize: 18,
    fontWeight: '500',
  },

  amountPositive: {
    color: theme.colors.primary,
  },

  amountNegative: {
    color: theme.colors.text,
  },

  timeText: {
    marginTop: 6,
    fontSize: 14,
    color: '#B6B6B6',
    fontWeight: '400',
  },

  itemDivider: {
    position: 'absolute',
    left: 66,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: '#ECECEC',
  },

  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },

  emptyWrap: {
    paddingTop: 80,
    alignItems: 'center',
  },

  emptyIcon: {
    width: 40,
    height: 40,
    marginBottom: 12,
  },

  emptyText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
});