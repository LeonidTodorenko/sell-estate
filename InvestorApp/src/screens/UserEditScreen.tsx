// screens/UserEditScreen.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';
import api from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'UserEdit'>;

// ДОЛЖНЫ совпадать с бэком (битовые значения)
const PermissionFlags = {
  ApprovePropertyPriceChange: 1 << 0, // 1
  ApprovePropertyFields:      1 << 1, // 2
  ApproveKyc:                 1 << 2, // 4
} as const;

const roles = [
  { value: 0, label: 'Investor' },
  { value: 1, label: 'Moderator' },
  { value: 2, label: 'Admin' },
];

type AdminUserDetails = {
  id: string;
  fullName: string;
  email: string;
  userRole: number;
  userRoleText: string;
  permissions: number;
  permissionsText: string[];
  isBlocked: boolean;
  isEmailConfirmed: boolean;
  createdAt: string;
};

export default function UserEditScreen({ route, navigation }: Props) {
  const { id, fullName: initialName, email: initialEmail } = route.params;

  // локальные стейты
  const [fullName, setFullName] = useState<string>(initialName ?? '');
  const [email, setEmail] = useState<string>(initialEmail ?? '');
  const [userRole, setUserRole] = useState<number>(route.params.userRole ?? 0);
  const [perms, setPerms] = useState<number>(route.params.permissions ?? 0);
  const [isBlocked, setIsBlocked] = useState<boolean>((route.params as any)?.isBlocked ?? false);
  const [isEmailConfirmed, setIsEmailConfirmed] = useState<boolean>((route.params as any)?.isEmailConfirmed ?? false);
  const [permissionsText, setPermissionsText] = useState<string[]>((route.params as any)?.permissionsText ?? []);
  const [userRoleText, setUserRoleText] = useState<string>((route.params as any)?.userRoleText ?? '');

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  // Если каких-то данных нет — подгружаем с бэка
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<AdminUserDetails>(`/admin/users/${id}`);
      setFullName(data.fullName);
      setEmail(data.email);
      setUserRole(data.userRole);
      setUserRoleText(data.userRoleText);
      setPerms(data.permissions);
      setPermissionsText(data.permissionsText ?? []);
      setIsBlocked(data.isBlocked);
      setIsEmailConfirmed(data.isEmailConfirmed);
    } catch (e: any) {
      console.error(e);
      if (e?.response?.status === 403) {
        Alert.alert('Access denied', 'You must be an admin to view this page.');
        navigation.goBack();
      } else {
        const msg = e?.response?.data?.message || 'Failed to load user';
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

  useEffect(() => {
    // Подгружаем только если нет текстовых полей — значит пришли “урезанные” params
    if (!userRoleText || permissionsText.length === 0) {
      load();
    }
  }, [load, userRoleText, permissionsText.length]);

  const toggleFlag = (flag: number) => {
    setPerms((prev) => (prev & flag ? prev & ~flag : prev | flag));
  };

  const isChecked = useMemo(
    () => (flag: number) => (perms & flag) === flag,
    [perms]
  );

  // Превью как строки прямо на клиенте, если бэк не прислал permissionsText
  const computedPermissionsText = useMemo(() => {
    if (permissionsText.length) return permissionsText;
    const names: string[] = [];
    if (isChecked(PermissionFlags.ApprovePropertyPriceChange)) names.push('ApprovePropertyPriceChange');
    if (isChecked(PermissionFlags.ApprovePropertyFields))      names.push('ApprovePropertyFields');
    if (isChecked(PermissionFlags.ApproveKyc))                 names.push('ApproveKyc');
    return names;
  }, [permissionsText, isChecked]);

  const sendMonthlyReport = async () => {
  Alert.alert(
    'Send monthly report',
    'Send report for previous month to this user?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          try {
            await api.post(`/admin/users/${id}/send-monthly-report`);
            Alert.alert('Done', 'Report send requested');
          } catch (e: any) {
            const msg = e?.response?.data?.message || 'Failed to send report';
            Alert.alert('Error', msg);
          }
        },
      },
    ]
  );
};


  const save = async () => {
    setSaving(true);
    try {
      // роль
      await api.post(`/admin/users/${id}/set-role`, { role: userRole });
      // пермишены
      try {
        await api.post(`/admin/users/${id}/set-permissions`, { permissions: perms });
      } catch (e: any) {
        if (e?.response?.status === 403) {
          Alert.alert('Note', 'Permissions update forbidden for your account.');
        } else {
          throw e;
        }
      }
      Alert.alert('Success', 'User updated');
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to update user';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  // ===== быстрые экшены =====
  const blockUnblock = async () => {
    setBusy(true);
    try {
      if (!isBlocked) {
        await api.post(`/users/${id}/block`);
        setIsBlocked(true);
        Alert.alert('Done', 'User blocked');
      } else {
        await api.post(`/users/${id}/unblock`);
        setIsBlocked(false);
        Alert.alert('Done', 'User unblocked');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed';
      Alert.alert('Error', msg);
    } finally {
      setBusy(false);
    }
  };

  const forceEmailConfirm = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/users/${id}/force-confirm-email`);
      setIsEmailConfirmed(true);
      Alert.alert('Done', 'Email set as confirmed');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed';
      Alert.alert('Error', msg);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    Alert.alert(
      'Reset password',
      'Set a temporary password and email it to the user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const { data } = await api.post(`/admin/users/${id}/reset-password`, {});
              Alert.alert('Done', `Temporary password: ${data?.tempPassword ?? '(sent by email)'}`);
            } catch (e: any) {
              const msg = e?.response?.data?.message || 'Failed';
              Alert.alert('Error', msg);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const resetPin = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/users/${id}/reset-pin`);
      Alert.alert('Done', 'PIN cleared');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed';
      Alert.alert('Error', msg);
    } finally {
      setBusy(false);
    }
  };

  // ===== пресеты прав =====
  const selectAll = () => {
    const all = PermissionFlags.ApprovePropertyPriceChange
              | PermissionFlags.ApprovePropertyFields
              | PermissionFlags.ApproveKyc;
    setPerms(all);
  };
  const selectNone = () => setPerms(0);
  const applyModeratorPreset = () => {
    // пример: модератор может approve поля и KYC
    setPerms(PermissionFlags.ApprovePropertyFields | PermissionFlags.ApproveKyc);
    setUserRole(1);
  };
  const applyAdminPreset = () => {
    selectAll();
    setUserRole(2);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.title}>Edit user</Text>

      {/* статусная плашка */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, isBlocked ? styles.badgeRed : styles.badgeGreen]}>
          <Text style={styles.badgeText}>{isBlocked ? 'Blocked' : 'Active'}</Text>
        </View>
        <View style={[styles.badge, isEmailConfirmed ? styles.badgeGreen : styles.badgeYellow]}>
          <Text style={styles.badgeText}>{isEmailConfirmed ? 'Email confirmed' : 'Email not confirmed'}</Text>
        </View>
      </View>

      <Text style={styles.label}>Name</Text>
      <Text style={styles.value}>{fullName}</Text>

      <Text style={styles.label}>Email</Text>
      <Text style={styles.value}>{email}</Text>

      <Text style={[styles.label, { marginTop: 16 }]}>Role</Text>
      <View style={styles.pillRow}>
        {roles.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.pill, userRole === r.value && styles.pillActive]}
            onPress={() => setUserRole(r.value)}
          >
            <Text style={[styles.pillText, userRole === r.value && styles.pillTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 8 }} />
      <View style={styles.actionsRow}>
        <BlueButton title="Moderator preset" onPress={applyModeratorPreset} />
        <View style={{ width: 8 }} />
        <BlueButton title="Admin preset" onPress={applyAdminPreset} />
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>Permissions</Text>
      <FlagRow
        label="Approve property price change"
        checked={isChecked(PermissionFlags.ApprovePropertyPriceChange)}
        onPress={() => toggleFlag(PermissionFlags.ApprovePropertyPriceChange)}
      />
      <FlagRow
        label="Approve property fields"
        checked={isChecked(PermissionFlags.ApprovePropertyFields)}
        onPress={() => toggleFlag(PermissionFlags.ApprovePropertyFields)}
      />
      <FlagRow
        label="Approve KYC"
        checked={isChecked(PermissionFlags.ApproveKyc)}
        onPress={() => toggleFlag(PermissionFlags.ApproveKyc)}
      />

      

      <View style={{ height: 8 }} />
      <View style={styles.actionsRow}>
        <BlueButton title="Select all" onPress={selectAll} />
        <View style={{ width: 8 }} />
        <BlueButton title="None" onPress={selectNone} />
      </View>

      {/* превью прав как чипы */}
      <View style={{ height: 8 }} />
      <Text style={[styles.label, { marginBottom: 6 }]}>Permissions preview</Text>
      <View style={styles.chipsRow}>
        {computedPermissionsText.length ? (
          computedPermissionsText.map((p) => (
            <View key={p} style={styles.chip}>
              <Text style={styles.chipText}>{p}</Text>
            </View>
          ))
        ) : (
          <Text style={{ color: '#666' }}>None</Text>
        )}
      </View>

      <View style={{ height: 16 }} />

      {/* Быстрые действия */}
      <Text style={[styles.label, { marginBottom: 8 }]}>Admin actions</Text>
      <View style={styles.actionsRow}>
        <BlueButton
          title={isBlocked ? 'Unblock' : 'Block'}
          onPress={blockUnblock}
          disabled={busy || loading}
        />
        <View style={{ width: 8 }} />
        <BlueButton
          title="Force email confirm"
          onPress={forceEmailConfirm}
          disabled={busy || isEmailConfirmed || loading}
        />
      </View>
      <View style={{ height: 8 }} />
      <View style={styles.actionsRow}>
        <BlueButton title="Reset password" onPress={resetPassword} disabled={busy || loading} />
        <View style={{ width: 8 }} />
        <BlueButton title="Reset PIN" onPress={resetPin} disabled={busy || loading} />
      </View>

      <View style={{ height: 8 }} />

    <View style={styles.actionsRow}>
      <BlueButton title="Send monthly report" onPress={sendMonthlyReport} disabled={busy} />
    </View>

      <View style={{ height: 16 }} />
      <BlueButton title={saving ? 'Saving...' : 'Save'} onPress={save} disabled={saving || loading} />
    </ScrollView>
  );
}

function FlagRow({ label, checked, onPress }:{
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.flagRow}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]} />
      <Text style={styles.flagText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12, display: 'none'  },

  badgeRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  badgeGreen: { backgroundColor: '#2ecc7033' },
  badgeYellow: { backgroundColor: '#f1c40f33' },
  badgeRed: { backgroundColor: '#e74c3c33' },
  badgeText: { fontWeight: '700' },

  label: { fontWeight: '600', marginTop: 6 },
  value: {
    paddingVertical: 8, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#ddd', borderRadius: 6, backgroundColor: '#fff',
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fff',
    marginRight: 8, marginTop: 8,
  },
  pillActive: { backgroundColor: '#0a84ff22', borderColor: '#0a84ff' },
  pillText: { fontWeight: '600' },
  pillTextActive: { color: '#0a84ff' },

  flagRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 2, borderColor: '#999', marginRight: 10, backgroundColor: '#fff',
  },
  checkboxOn: { backgroundColor: '#0a84ff', borderColor: '#0a84ff' },
  flagText: { fontSize: 15 },

  actionsRow: { flexDirection: 'row', alignItems: 'center' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#eef5ff', borderRadius: 16, borderWidth: 1, borderColor: '#cfe0ff' },
  chipText: { fontSize: 12, color: '#0a84ff', fontWeight: '600' },
});
