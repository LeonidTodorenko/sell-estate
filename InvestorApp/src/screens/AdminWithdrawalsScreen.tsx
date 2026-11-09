import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList,  StyleSheet, Alert, TextInput, ScrollView } from 'react-native';
// import { useNavigation } from '@react-navigation/native';
// import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  status: string;
  createdAt: string;
  testDestination?: string;
  rejectionReason?: string;
  processedAt?: string;
  processedBy?: string;
}

const AdminWithdrawalsScreen = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [status,setStatus] = useState('');
  const [reviewing,setReviewing] = useState('');
  const [reason,setReason] = useState('');
  const [busy,setBusy] = useState(false);
  const lock = useRef(false);

  const loadData = async () => {
    try {
      const response = await api.get('/withdrawals/all');
      setWithdrawals(response.data);
    } catch (error) {
      console.error('Error loading withdrawals', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await api.post(`/withdrawals/${id}/${action}`,{reason:action==="reject"?reason.trim():undefined});
      Alert.alert('Success', `Withdrawal ${action}ed`);
      setReviewing("");
      setReason("");
    } catch (error) {
      console.error('Error updating status', error);
      Alert.alert('Error', 'Review failed. Check the updated request status.');
    } finally {
      await loadData();
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TEST Withdrawals</Text>
      <Text>Approval simulates a payout. Rejection returns reserved funds.</Text>
      <ScrollStatus status={status} setStatus={setStatus}/>
      <BlueButton title="Refresh requests" disabled={busy} onPress={()=>void loadData()}/>
      <FlatList
        data={withdrawals.filter(item=>!status||item.status===status)}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>User ID: {item.userId}</Text>
            <Text>Amount: {item.amount} USD</Text>
            <Text>Status: {item.status}</Text>
            <Text>Date: {new Date(item.createdAt).toLocaleDateString()}</Text>

            <Text>Request {item.id}</Text>
            <Text>Destination {item.testDestination ?? 'Legacy request'}</Text>
            {item.processedAt&&<Text>Processed {new Date(item.processedAt).toLocaleString()} by {item.processedBy}</Text>}
            {item.rejectionReason&&<Text>Declined: {item.rejectionReason}</Text>}
            {item.status === 'pending' && <>
              <BlueButton title="Simulate TEST payout" disabled={busy} onPress={()=>Alert.alert(
                'Simulate payout?', 'This will finalize the TEST request.',
                [{text:'Back',style:'cancel'},{text:'Approve',onPress:()=>void handleAction(item.id,'approve')}],
              )}/>
              <BlueButton title="Decline request" disabled={busy} variant="red"
                onPress={()=>{setReviewing(item.id);setReason('');}}/>
              {reviewing===item.id&&<>
                <TextInput placeholder="Decline reason" maxLength={240} value={reason} editable={!busy} onChangeText={setReason}/>
                <BlueButton title="Reject & return funds" disabled={busy||!reason.trim()} variant="red"
                  onPress={()=>void handleAction(item.id,'reject')}/>
              </>}
            </>}
          </View>
        )}
      />
    </View>
  );
};

function ScrollStatus({status,setStatus}:{status:string;setStatus:(status:string)=>void}) {
  return <View><ScrollView horizontal>
    {['','pending','approved','rejected','canceled'].map(value=><Text key={value} accessibilityRole="button"
      accessibilityState={{selected:status===value}} style={{padding:10,fontWeight:status===value?'bold':'normal'}}
      onPress={()=>setStatus(value)}>{value||'All statuses'}</Text>)}
  </ScrollView></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16,backgroundColor: theme.colors.background },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
  },
});

export default AdminWithdrawalsScreen;
