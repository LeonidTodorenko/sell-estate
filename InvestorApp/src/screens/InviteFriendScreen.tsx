// screens/InviteFriendScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, FlatList } from 'react-native';
import StyledInput from '../components/StyledInput';
import BlueButton from '../components/BlueButton';
import api from '../api';
import theme from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

type InviteRow = {
  id: string;
  inviteeEmail: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  status: string;
};

type ClubInfo = {
  totalAssets: number;
  status: string;
  baseFee: number;
  withReferralFee: number;
  canInvite: boolean;
  referrerRewardPercent: number;
  referrerRewardYears: number;
};


export default function InviteFriendScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [list, setList] = useState<InviteRow[]>([]);

    const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);

  const load = async () => {
    try {
      const { data } = await api.get('/referrals/my-invites');
      setList(data);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Failed to load invites');
    }
  };

  const sendInvite = async () => {
    if (!email.trim()) {
      Alert.alert('Validation', 'Enter email');
      return;
    }
        if (clubInfo && !clubInfo.canInvite) {
      Alert.alert(
        'Invitation not available',
        'Referral invites are available starting from total assets of 10 000 USD.'
      );
      return;
    }

    setSending(true);
    try {
      const { data } = await api.post('/referrals/invite', { email: email.trim() });
      // покажем код/ссылку сразу (их нет в списке по безопасности)
      Alert.alert(
        'Invite sent',
        `Code: ${data.code}\nLink:\n${data.link}\n\n`
      );
      setEmail('');
      load();
    } catch (e: any) {
      console.error(e);
      let msg = 'Failed to send invite';
      if (e?.response?.data?.message) msg = e.response.data.message;
      Alert.alert('Error', msg);
    } finally {
      setSending(false);
    }
  };

    useEffect(() => {
    const loadAll = async () => {
      try {
        await load(); // загрузка списка инвайтов

        const stored = await AsyncStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          const userId = parsed.userId as string;

          const { data } = await api.get(`/share-offers/${userId}/club-info`);
          setClubInfo(data);
        }
      } catch (e: any) {
        console.error(e);
      }
    };

    loadAll();
  }, []);


  useEffect(() => { load(); }, []);



  const renderItem = ({ item }: { item: InviteRow }) => (
    <View style={styles.card}>
      <Text style={styles.rowEmail}>{item.inviteeEmail}</Text>
      <Text>Status: {item.status}</Text>
      <Text>Created: {new Date(item.createdAt).toLocaleString()}</Text>
      <Text>Expires: {new Date(item.expiresAt).toLocaleString()}</Text>
      {item.acceptedAt && <Text>Accepted: {new Date(item.acceptedAt).toLocaleString()}</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invite a friend</Text>

            {clubInfo && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: '600' }}>
            Your club status: {clubInfo.status}
          </Text>
          <Text>
            Total assets (for club level): {clubInfo.totalAssets.toFixed(2)} USD
          </Text>

          <Text>
            Platform profit fee: {(clubInfo.baseFee * 100).toFixed(1)}% standard,{' '}
            {(clubInfo.withReferralFee * 100).toFixed(1)}% for referred users.
          </Text>

          {clubInfo.referrerRewardPercent > 0 && clubInfo.canInvite && (
            <Text style={{ marginTop: 4 }}>
              If your friend uses your invite, you will receive{' '}
              {(clubInfo.referrerRewardPercent * 100).toFixed(1)}% of their profit fee
              for {clubInfo.referrerRewardYears} year(s).
            </Text>
          )}

          {!clubInfo.canInvite && (
            <Text style={{ marginTop: 4, color: '#b00020' }}>
              Referral invites become available from 10 000 USD total assets.
            </Text>
          )}
        </View>
      )}


      <StyledInput
        style={styles.input}
        placeholder="Friend's email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <BlueButton title={sending ? 'Sending...' : 'Send invite'} onPress={sendInvite} disabled={sending || (clubInfo !== null && !clubInfo.canInvite)}      />
      

      <Text style={styles.subTitle}>Sent invites</Text>
      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No invites yet.</Text>}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  subTitle: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: { marginBottom: 10 },
  empty: { textAlign: 'center', color: '#777', marginTop: 16 },
  card: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    marginBottom: 10,
  },
  rowEmail: { fontWeight: '700', marginBottom: 4 },
});
