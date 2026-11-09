import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import api from '../api';
import BlueButton from '../components/BlueButton';
import { useQueryClient } from '@tanstack/react-query';
import theme from '../constants/theme';
import { loadSession } from '../services/sessionStorage';

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  testDestination?: string;
  rejectionReason?: string;
  processedAt?: string;
}

const MyWithdrawalsScreen = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  const query = useQueryClient();
  const [accountId,setAccountId] = useState('');
  const [busy,setBusy] = useState(false);
  const lock = useRef(false);
  async function loadData() {
    try {
      const session = await loadSession();
      const id = session?.user?.id ?? session?.user?.userId;
      if (!id) return;
      setAccountId(String(id).toLowerCase());
      setIsDemo(!!session?.isDemo);
      setWithdrawals((await api.get('/withdrawals/user/'+id)).data);
    } catch {
      Alert.alert('Error','Could not load withdrawal history.');
    }
  }

  useEffect(() => { void loadData(); }, []);

  async function cancel(id:string) {
    if (lock.current || !accountId || isDemo) return;
    lock.current = true;
    setBusy(true);
    try {
      await api.post('/withdrawals/'+id+'/cancel',{}, {walletOwner:accountId,walletDemo:false,silentError:true} as any);
      void query.invalidateQueries({queryKey:['home']});
    } catch {
      Alert.alert('Cancellation unavailable','Check the updated request status.');
    } finally {
      await loadData();
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Withdrawal Requests</Text>
      {isDemo && <Text style={styles.demoNotice}>Demo withdrawals are simulated instantly; they never enter the production approval queue.</Text>}
      {!isDemo&&<Text>TEST/manual withdrawals. Approval simulates a payout.</Text>}
      <BlueButton title="Refresh history" disabled={busy} onPress={()=>void loadData()}/>
      <FlatList
        data={withdrawals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>Amount: {item.amount} USD</Text>
            <Text>Status: {item.status}</Text>
            <Text>Date: {new Date(item.createdAt).toLocaleDateString()}</Text>
            {item.testDestination&&<Text>Test destination {item.testDestination}</Text>}
            {item.processedAt&&<Text>Processed {new Date(item.processedAt).toLocaleString()}</Text>}
            {item.rejectionReason&&<Text>Declined: {item.rejectionReason}</Text>}
            {!isDemo&&item.status==='pending'&&<BlueButton title="Cancel & return funds" disabled={busy}
              onPress={()=>Alert.alert('Cancel TEST withdrawal?', 'The reserved amount will be returned.',
                [{text:'Back',style:'cancel'},{text:'Cancel request',onPress:()=>void cancel(item.id)}])}/>}
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No withdrawal requests yet.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 ,backgroundColor: theme.colors.background},
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, display: 'none'  },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
  },
  demoNotice: { backgroundColor: '#E8F7F0', color: '#087A4B', padding: 12, borderRadius: 10, marginBottom: 14 },
});

export default MyWithdrawalsScreen;
