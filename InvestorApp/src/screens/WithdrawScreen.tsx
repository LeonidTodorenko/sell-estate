import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import api from '../api';
import BlueButton from '../components/BlueButton';
import StyledInput from '../components/StyledInput';
import { loadSession } from '../services/sessionStorage';
import { walletRequestId } from '../payments';

const testDestination = 'TEST-BANK-001';
type Attempt = { requestKey: string; amount: number; testDestination: string };

export default function WithdrawScreen() {
  const navigation = useNavigation();
  const query = useQueryClient();
  const [account,setAccount] = useState<{id:string; demo:boolean}|null>(null);
  const [attempt,setAttempt] = useState<Attempt|null>(null);
  const [balance,setBalance] = useState<number|null>(null);
  const [amount,setAmount] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const session = await loadSession();
      const userId = session?.user?.id ?? session?.user?.userId;
      if (!session || !userId) throw new Error('Sign in to submit a withdrawal.');
      const id = String(userId).toLowerCase();
      const saved = await AsyncStorage.getItem('ownersclub.withdrawal.'+id);
      if (!active) return;
      setAttempt(saved ? JSON.parse(saved) : null);
      setAccount({id,demo:!!session.isDemo});
      const {data} = await api.get('/users/'+id);
      if (active && typeof data.walletBalance === 'number') setBalance(data.walletBalance);
    })().catch(() => { if (active) setError('Could not load wallet details.'); });
    return () => { active = false; };
  }, []);

  async function submit() {
    if (lock.current || !account) return;
    const normalized = amount.replace(',', '.').trim();
    const value = Number(normalized);
    if (!attempt && (!/^\d+(\.\d{1,2})?$/.test(normalized) || !Number.isFinite(value) || value <= 0)) {
      setError('Enter a positive amount with up to two decimal places.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    const key = 'ownersclub.withdrawal.'+account.id;
    try {
      const pending = attempt ?? {requestKey:walletRequestId(),amount:value,testDestination};
      await AsyncStorage.setItem(key,JSON.stringify(pending));
      setAttempt(pending);
      await api.post('/withdrawals/request',pending,{walletOwner:account.id,walletDemo:account.demo,silentError:true} as any);
      await AsyncStorage.removeItem(key);
      setAttempt(null);
      void query.invalidateQueries({queryKey:['home']});
      Alert.alert('TEST withdrawal',account.demo ? 'Demo withdrawal simulated.' : 'Request saved. See withdrawal history for its current status.');
      navigation.goBack();
    } catch (e) {
      const response = (e as {response?:{status:number;data?:{message?:string}}}).response;
      if (response?.status === 400) {
        await AsyncStorage.removeItem(key);
        setAttempt(null);
      }
      setError(response?.data?.message ?? 'Result unavailable. Retry the saved request.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <ScrollView contentContainerStyle={{padding:20,gap:16}}>
    <Text style={{fontSize:22}}>Withdraw Funds</Text>
    <Text>{account?.demo ? 'Demo withdrawals are simulated instantly.' : 'TEST/manual withdrawal. The amount is reserved until review. Approval simulates a payout.'}</Text>
    {balance!==null&&<Text>Available balance {balance.toFixed(2)} USD</Text>}
    {!account?.demo&&<Text>Test bank destination {testDestination}</Text>}
    <StyledInput placeholder="Amount (USD)" keyboardType="decimal-pad" value={String(attempt?.amount??amount)}
      editable={!attempt&&!busy} onChangeText={setAmount}/>
    <BlueButton title={busy?'Submitting…':attempt?'Recover request':'Submit TEST withdrawal'}
      disabled={!account||busy} onPress={()=>void submit()}/>
    {!!error&&<Text accessibilityRole="alert">{error}</Text>}
    <BlueButton title="Back" onPress={()=>navigation.goBack()}/>
  </ScrollView>;
}
