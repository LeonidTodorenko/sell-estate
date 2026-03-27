import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
} from 'react-native';
import api from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import theme from '../constants/theme';

interface Trade {
  timestamp: string;
  shares: number;
  pricePerShare: number;
  propertyId: string;
  propertyTitle: string;
  buyerId: string;
  sellerId: string;
}

type HistoryTab = 'buy' | 'sell';

const HistoryTabButton = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={styles.historyTabBtn}>
    <Text style={[styles.historyTabText, active && styles.historyTabTextActive]}>{label}</Text>
    <View style={[styles.historyTabUnderline, active && styles.historyTabUnderlineActive]} />
  </Pressable>
);

const TradeHistoryScreen = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<HistoryTab>('buy');

  const loadUserId = useCallback(async () => {
    const stored = await AsyncStorage.getItem('user');
    const user = stored ? JSON.parse(stored) : null;
    if (user) setUserId(user.userId);
  }, []);

  const loadTrades = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/share-offers/transactions');
      setTrades(res.data ?? []);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserId();
    loadTrades();
  }, [loadUserId, loadTrades]);

  const filteredTrades = useMemo(() => {
    if (!userId) return [];
    const base =
      activeTab === 'buy'
        ? trades.filter((t) => t.buyerId === userId)
        : trades.filter((t) => t.sellerId === userId);

    return [...base].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [trades, userId, activeTab]);

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>History orders</Text>

      <View style={styles.tabsRow}>
        <HistoryTabButton
          label="Buy"
          active={activeTab === 'buy'}
          onPress={() => setActiveTab('buy')}
        />
        <HistoryTabButton
          label="Sell"
          active={activeTab === 'sell'}
          onPress={() => setActiveTab('sell')}
        />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredTrades}
          keyExtractor={(item, index) => `${item.propertyId}-${item.timestamp}-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {activeTab === 'buy' ? 'No buy history yet' : 'No sell history yet'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.propertyTitle} numberOfLines={1}>
                    {item.propertyTitle}
                  </Text>
                  <Text style={styles.cardSubText}>
                    {new Date(item.timestamp).toLocaleDateString()}
                  </Text>
                </View>

                <View style={styles.rightWrap}>
                  <Text style={styles.priceText}>{theme.colors.text && `$${item.pricePerShare.toFixed(2)}`}</Text>
                  <Text style={styles.priceCaption}>per share</Text>
                </View>
              </View>

              <View style={styles.cardBottomRow}>
                <Text style={styles.metaText}>{item.shares} shares</Text>
                <Text style={styles.totalText}>Total {`$${(item.shares * item.pricePerShare).toFixed(2)}`}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
};

export default TradeHistoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 14,
  },

  tabsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },

  historyTabBtn: {
    flex: 1,
    alignItems: 'center',
  },

  historyTabText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  historyTabTextActive: {
    color: theme.colors.text,
  },

  historyTabUnderline: {
    marginTop: 8,
    width: '100%',
    height: 2,
    backgroundColor: 'transparent',
    borderRadius: 999,
  },

  historyTabUnderlineActive: {
    backgroundColor: theme.colors.text,
  },

  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: {
    paddingBottom: 120,
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 10,
  },

  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  cardTextWrap: {
    flex: 1,
    paddingRight: 12,
  },

  propertyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },

  cardSubText: {
    marginTop: 3,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },

  rightWrap: {
    alignItems: 'flex-end',
  },

  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },

  priceCaption: {
    marginTop: 2,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },

  cardBottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  metaText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },

  totalText: {
    fontSize: 12,
    color: theme.colors.success,
    fontWeight: '700',
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
});