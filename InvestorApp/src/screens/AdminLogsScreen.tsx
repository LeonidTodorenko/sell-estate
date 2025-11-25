import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import api from '../api';
import StyledInput from '../components/StyledInput';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

interface ActionLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

interface LogsResponse {
  total: number;
  page: number;
  pageSize: number;
  items: ActionLog[];
}

const PAGE_SIZE = 20;

const AdminLogsScreen = () => {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [userNameFilter, setUserNameFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // ===== состояние для audit-отчёта =====
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [auditSending, setAuditSending] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<LogsResponse>('/admin/stats/logs', {
        params: {
          action: actionFilter || undefined,
          userName: userNameFilter || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
      });
      setLogs(response.data.items);
      setTotal(response.data.total);
    } catch (err: any) {
      console.error('Failed to load logs:', err);
      const msg = err?.response?.data?.message || 'Failed to load logs';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, userNameFilter, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const renderItem = ({ item }: { item: ActionLog }) => (
    <View style={styles.card}>
      <Text style={styles.action}>{item.action}</Text>
      <Text style={styles.details}>{item.details}</Text>
      <Text style={styles.meta}>User: {item.userName || item.userId}</Text>
      <Text style={styles.meta}>
        At: {new Date(item.timestamp).toLocaleString()}
      </Text>
    </View>
  );

  // ===== helpers для дат (audit-report) =====

  const formatDate = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD

  const applyLast7Days = () => {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - 7);
    setFromDate(formatDate(from));
    setToDate(formatDate(today));
  };

  const applyLast30Days = () => {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - 30);
    setFromDate(formatDate(from));
    setToDate(formatDate(today));
  };

  const applyLastMonth = () => {
    const now = new Date();
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1); // день до начала текущего

    setFromDate(formatDate(firstOfPrevMonth));
    setToDate(formatDate(lastOfPrevMonth));
  };

  const sendAuditReport = async () => {
    if (!fromDate || !toDate) {
      Alert.alert('Dates required', 'Please set both From and To dates.');
      return;
    }

    // лёгкая проверка, чтобы не перепутать местами
    if (fromDate > toDate) {
      Alert.alert('Invalid range', '"From" date must be before "To" date.');
      return;
    }

    setAuditSending(true);
    try {
      await api.post('/admin/stats/reports/audit/send', {
        from: fromDate,
        to: toDate,
      });
      Alert.alert('Done', 'Audit log report has been sent to admin email.');
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.message || 'Failed to send audit report';
      Alert.alert('Error', msg);
    } finally {
      setAuditSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📋 Action Logs</Text>

      {/* ===== Блок отправки audit-отчёта ===== */}
      <View style={styles.auditCard}>
        <Text style={styles.auditTitle}>Audit log report to email</Text>
        <Text style={styles.auditHint}>
          Generate CSV with all actions for selected period and send to admin email.
        </Text>

        <View style={styles.auditQuickRow}>
          <BlueButton title="Last 7 days" onPress={applyLast7Days} />
          <View style={{ width: 8 }} />
          <BlueButton title="Last 30 days" onPress={applyLast30Days} />
        </View>

        <View style={[styles.auditQuickRow, { marginTop: 6 }]}>
          <BlueButton title="Last month" onPress={applyLastMonth} />
        </View>

        <View style={styles.auditDatesRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>From (YYYY-MM-DD)</Text>
            <StyledInput
              placeholder="2025-10-01"
              value={fromDate}
              onChangeText={setFromDate}
              autoCapitalize="none"
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>To (YYYY-MM-DD)</Text>
            <StyledInput
              placeholder="2025-10-31"
              value={toDate}
              onChangeText={setToDate}
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          <BlueButton
            title={auditSending ? 'Sending...' : 'Send to email'}
            onPress={sendAuditReport}
            disabled={auditSending}
          />
        </View>
      </View>

      {/* ===== Фильтры логов ===== */}
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
        <BlueButton
          title="Apply"
          onPress={() => {
            setPage(1);
            fetchLogs();
          }}
        />
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
        <BlueButton
          title="Previous"
          onPress={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        />
        <Text style={styles.pageNumber}>
          Page {page} / {totalPages}
        </Text>
        <BlueButton
          title="Next"
          onPress={() => setPage((p) => p + 1)}
          disabled={page >= totalPages}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },

  // === audit card ===
  auditCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    marginBottom: 16,
  },
  auditTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  auditHint: {
    fontSize: 12,
    color: '#555',
    marginBottom: 8,
  },
  auditQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  auditDatesRow: {
    flexDirection: 'row',
    marginTop: 8,
  },

  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
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
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
});

export default AdminLogsScreen;
