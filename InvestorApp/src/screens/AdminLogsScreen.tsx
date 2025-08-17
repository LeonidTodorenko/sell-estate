import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator  } from 'react-native';
import api from '../api';
import StyledInput from '../components/StyledInput';
import BlueButton from '../components/BlueButton';

interface ActionLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

const PAGE_SIZE = 20;

const AdminLogsScreen = () => {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [userNameFilter, setUserNameFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/stats/logs', {
        params: {
          action: actionFilter,
          userName: userNameFilter,
          page,
          pageSize: PAGE_SIZE
        }
      });
      setLogs(response.data.items);
      setTotal(response.data.total);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, userNameFilter, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const renderItem = ({ item }: { item: ActionLog }) => (
    <View style={styles.card}>
      <Text style={styles.action}>{item.action}</Text>
      <Text style={styles.details}>{item.details}</Text>
      <Text style={styles.meta}>User: {item.userName || item.userId}</Text>
      <Text style={styles.meta}>At: {new Date(item.timestamp).toLocaleString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📋 Action Logs</Text>

      <View style={styles.filterRow}>
        <StyledInput
          placeholder="Filter by action"
          style={styles.input}
          value={actionFilter}
          onChangeText={setActionFilter}
        />
        <StyledInput
          placeholder="Filter by user name"
          style={styles.input}
          value={userNameFilter}
          onChangeText={setUserNameFilter}
        />
        <BlueButton title="Apply" onPress={() => { setPage(1); fetchLogs(); }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      )}

      <View style={styles.pagination}>
        <BlueButton title="Previous" onPress={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} />
        <Text style={styles.pageNumber}>Page {page}</Text>
        <BlueButton title="Next" onPress={() => setPage(p => p + 1)} disabled={page >= totalPages} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  action: { fontWeight: 'bold', fontSize: 16 },
  details: { marginTop: 4, fontSize: 14 },
  meta: { fontSize: 12, color: '#666', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginRight: 8,
    flex: 1,
    borderRadius: 4,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  pageNumber: {
    fontSize: 16,
  }
});

export default AdminLogsScreen;
