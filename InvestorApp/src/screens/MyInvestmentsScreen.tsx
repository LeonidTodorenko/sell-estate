import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';

import api from '../api';
import BlueButton from '../components/BlueButton';
import ScreenLoader from '../components/ScreenLoader';
import theme from '../constants/theme';

interface Investment {
  id: string;
  propertyId: string;
  shares: number;
  investedAmount: number;
  createdAt: string;
}

async function fetchUserInvestments(userId: string): Promise<Investment[]> {
  const response = await api.get<Investment[]>(
    `/investments/user/${userId}`,
    { silentLoading: true } as any,
  );

  return [...(response.data ?? [])].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime(),
  );
}

const MyInvestmentsScreen = () => {
  const [userId, setUserId] = useState<string | null>(null);

  const [minShares, setMinShares] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [daysBack, setDaysBack] = useState('30');

  useEffect(() => {
    const loadUserId = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');

        if (!stored) {
          setUserId(null);
          return;
        }

        const user = JSON.parse(stored);
        setUserId(user.userId ?? user.id ?? user.user?.id ?? null);
      } catch (error) {
        console.error('Failed to read user session', error);
        setUserId(null);
      }
    };

    loadUserId();
  }, []);

  const {
    data: investments = [],
    isLoading,
    isFetching,
    refetch,
    isError,
  } = useQuery({
    queryKey: ['myInvestmentsHistory', userId],
    queryFn: () => fetchUserInvestments(userId!),
    enabled: !!userId,
    staleTime: 2 * 60_000,
    gcTime: 15 * 60_000,
  });

  const filtered = useMemo(() => {
    const minS = Number.parseInt(minShares, 10) || 0;
    const minA = Number.parseFloat(minAmount) || 0;
    const parsedDays = Number.parseInt(daysBack, 10);

    const sinceDate =
      Number.isFinite(parsedDays) && parsedDays > 0
        ? new Date(Date.now() - parsedDays * 24 * 60 * 60 * 1000)
        : null;

    return investments.filter((investment) => {
      const matchesShares = investment.shares >= minS;
      const matchesAmount = investment.investedAmount >= minA;
      const matchesDate =
        !sinceDate || new Date(investment.createdAt) >= sinceDate;

      return matchesShares && matchesAmount && matchesDate;
    });
  }, [investments, minShares, minAmount, daysBack]);

  if (!userId || (isLoading && investments.length === 0)) {
    return <ScreenLoader />;
  }

  if (isError && investments.length === 0) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.errorText}>Failed to load investments.</Text>

        <BlueButton
          title="Try Again"
          onPress={() => refetch()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Investment</Text>

      <View style={styles.filters}>
        <View style={styles.filterGroup}>
          <Text style={styles.label}>Min Shares:</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={minShares}
            onChangeText={setMinShares}
          />
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.label}>Min Amount:</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={minAmount}
            onChangeText={setMinAmount}
          />
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.label}>Last X days:</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={daysBack}
            onChangeText={setDaysBack}
          />
        </View>

        <BlueButton
          title={isFetching ? 'Refreshing...' : 'Refresh'}
          onPress={() => refetch()}
          disabled={isFetching}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshing={isFetching && !isLoading}
        onRefresh={refetch}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>Property ID: {item.propertyId}</Text>
            <Text>Shares: {item.shares}</Text>
            <Text>Invested: {item.investedAmount.toFixed(2)} USD</Text>
            <Text>Date: {new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No investments match your filters.
          </Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.colors.background,
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    display: 'none',
  },

  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
  },

  filters: {
    marginBottom: 16,
  },

  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    padding: 8,
    marginVertical: 6,
    borderRadius: 6,
  },

  label: {
    fontWeight: 'bold',
    marginBottom: 4,
  },

  filterGroup: {
    marginBottom: 12,
  },

  centerState: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },

  errorText: {
    fontSize: 16,
    color: theme.colors.danger,
    textAlign: 'center',
    marginBottom: 16,
  },

  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: theme.colors.textSecondary,
  },
});

export default MyInvestmentsScreen;