// screens/UsersListScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import StyledInput from '../components/StyledInput';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';
import api from '../api';
import { RootStackParamList } from '../navigation/AppNavigator';
 
type Nav = NativeStackNavigationProp<RootStackParamList, 'UsersLists'>;
 

type UserRow = {
  id: string;
  fullName: string;
  email: string;

  // пришло с бэка
  userRole: number;          // enum как число — для редактирования
  userRoleText: string;      // человекочитаемый текст роли
  permissions: number;       // битовая маска — для редактирования
  permissionsText: string[]; // список текстов флагов

  isBlocked: boolean;
  isEmailConfirmed: boolean;
  createdAt: string;
};

export default function UsersListScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [list, setList] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<UserRow[]>('/admin/users', {
        params: { query: query || undefined },
      });
      setList(data);
    } catch (e: any) {
      console.error(e);
      if (e?.response?.status === 403) {
        Alert.alert('Access denied', 'You must be an admin to view this page.');
      } else {
        const msg = e?.response?.data?.message || 'Failed to load users';
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (u: UserRow) => {
    navigation.navigate('UserEdit', {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      userRole: u.userRole ?? 0,
      permissions: u.permissions ?? 0,
    });
  };

  const renderItem = ({ item }: { item: UserRow }) => (
    <TouchableOpacity onPress={() => openEdit(item)} style={styles.card}>
      <Text style={styles.name}>{item.fullName}</Text>
      <Text>{item.email}</Text>

      <Text>Role: {item.userRoleText || String(item.userRole)}</Text>

      <Text>
        Perms:{' '}
        {item.permissionsText && item.permissionsText.length > 0
          ? item.permissionsText.join(', ')
          : 'None'}
      </Text>

      <Text>Email confirmed: {item.isEmailConfirmed ? 'yes' : 'no'}</Text>
      <Text>Blocked: {item.isBlocked ? 'yes' : 'no'}</Text>
      <Text style={styles.created}>
        Created: {new Date(item.createdAt).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Users</Text>

      <View style={styles.row}>
        <StyledInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Search name or email"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        <View style={{ width: 8 }} />
        <BlueButton title="Search" onPress={load} />
      </View>

      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No users</Text> : null}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12, display: 'none'  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  input: { marginBottom: 0 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 10,
  },
  name: { fontSize: 16, fontWeight: '700' },
  created: { marginTop: 4, color: '#666' },
  empty: { textAlign: 'center', color: '#777', marginTop: 20 },
});
