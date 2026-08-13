import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import api from '../api';
import BlueButton from '../components/BlueButton';
import ErrorState from '../components/ErrorState';
import StyledInput from '../components/StyledInput';
import theme from '../constants/theme';
import Haptics from '../services/HapticsService';

type DemoAccount = { id: string; demoCode: string; fullName: string; email: string; walletBalance: number; isTemplate: boolean; isActive: boolean; createdAt: string; lastActiveAt: string | null; expiresAt: string | null };
type Form = { fullName: string; email: string; password: string; demoCode: string; expiresAt: string };
const EMPTY: Form = { fullName: '', email: '', password: '', demoCode: '', expiresAt: '' };
const message = (e: any, fallback: string) => e?.response?.data?.message || e?.response?.data?.title || fallback;
const dateText = (value: string | null) => value ? new Date(value).toLocaleString() : 'Never';
const money = (value: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
const daysLeft = (value: string | null) => value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : null;
const expiryText = (value: string | null, remaining: number | null) => {
  if (!value || remaining === null) return 'No expiration';
  return `${dateText(value)} · ${remaining <= 0 ? 'Expired' : `${remaining} day${remaining === 1 ? '' : 's'} left`}`;
};

export default function AdminDemoAccountsScreen() {
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const response = await api.get<DemoAccount[]>('/admin/demo-accounts', { silentError: true, silentLoading: refresh } as any);
      setAccounts(Array.isArray(response.data) ? response.data : []);
      setError(null);
    } catch (e: any) {
      setError(message(e, 'Demo accounts could not be loaded.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const setField = (key: keyof Form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const close = () => { if (!submitting) { setShowCreate(false); setForm(EMPTY); } };

  const create = async () => {
    const fullName = form.fullName.trim();
    const email = form.email.trim();
    const demoCode = form.demoCode.trim();
    const expiry = form.expiresAt.trim();
    if (!fullName || !email || !form.password) return Alert.alert('Missing details', 'Full name, email, and password are required.');
    if (form.password.length < 8) return Alert.alert('Password too short', 'Password must contain at least 8 characters.');
    let expiresAt: string | undefined;
    if (expiry) {
      const parsed = new Date(expiry);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) return Alert.alert('Invalid expiry', 'Enter a future date, for example 2026-12-31.');
      expiresAt = parsed.toISOString();
    }
    setSubmitting(true);
    try {
      await api.post('/admin/demo-accounts', { fullName, email, password: form.password, demoCode: demoCode || undefined, expiresAt }, { silentError: true } as any);
      Haptics.success(); setShowCreate(false); setForm(EMPTY); await load();
      Alert.alert('Demo account created', 'The account was created from DEMO-TEMPLATE.');
    } catch (e: any) { Haptics.error(); Alert.alert('Could not create account', message(e, 'Please try again.')); }
    finally { setSubmitting(false); }
  };

  const reset = (account: DemoAccount) => {
    if (account.isTemplate) return;
    Alert.alert('Reset demo account?', `This replaces ${account.fullName}'s sandbox data with a fresh copy of DEMO-TEMPLATE.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
        setPendingId(account.id);
        try { await api.post(`/admin/demo-accounts/${account.id}/reset`, undefined, { silentError: true } as any); Haptics.success(); await load(); Alert.alert('Account reset', 'Sandbox data was restored.'); }
        catch (e: any) { Haptics.error(); Alert.alert('Reset failed', message(e, 'Please try again.')); }
        finally { setPendingId(null); }
      } },
    ]);
  };

  const toggle = async (account: DemoAccount) => {
    if (account.isTemplate) return;
    setPendingId(account.id);
    try { await api.put(`/admin/demo-accounts/${account.id}/active`, { isActive: !account.isActive }, { silentError: true } as any); Haptics.success(); await load(); }
    catch (e: any) { Haptics.error(); Alert.alert('Status update failed', message(e, 'Please try again.')); }
    finally { setPendingId(null); }
  };

  const renderItem = ({ item }: { item: DemoAccount }) => {
    const remaining = daysLeft(item.expiresAt);
    const pending = pendingId === item.id;
    return <View style={[styles.card, item.isTemplate && styles.templateCard]}>
      <View style={styles.header}><View style={styles.grow}><Text style={styles.name}>{item.fullName}</Text><Text style={styles.secondary}>{item.email}</Text></View>
        <Text style={[styles.badge, item.isActive ? styles.active : styles.inactive]}>{item.isActive ? 'Active' : 'Inactive'}</Text></View>
      {item.isTemplate && <View style={styles.template}><Text style={styles.templateTitle}>DEMO-TEMPLATE</Text><Text style={styles.templateHint}>Protected source account · actions disabled</Text></View>}
      <View style={styles.row}><Text style={styles.secondary}>Demo code</Text><Text selectable style={styles.code}>{item.demoCode || '—'}</Text></View>
      <Text style={styles.balance}>{money(item.walletBalance)}</Text>
      <Text style={styles.meta}>Created: {dateText(item.createdAt)}</Text>
      <Text style={styles.meta}>Last active: {dateText(item.lastActiveAt)}</Text>
      <Text style={[styles.meta, remaining !== null && remaining <= 0 && styles.expired]}>Expires: {expiryText(item.expiresAt, remaining)}</Text>
      {!item.isTemplate && <View style={styles.actions}><BlueButton title={pending ? 'Please wait...' : 'Reset'} onPress={() => reset(item)} variant="orange" disabled={pending} style={styles.action}/><BlueButton title={pending ? 'Please wait...' : item.isActive ? 'Deactivate' : 'Activate'} onPress={() => toggle(item)} variant={item.isActive ? 'red' : 'green'} disabled={pending} style={styles.action}/></View>}
    </View>;
  };

  return <View style={styles.container}>
    <View style={styles.top}><View style={styles.grow}><Text style={styles.title}>Demo Sandbox</Text><Text style={styles.secondary}>Create and manage isolated demo accounts.</Text></View><BlueButton title="Create" onPress={() => setShowCreate(true)} /></View>
    {loading && !accounts.length ? <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary}/><Text style={styles.loading}>Loading demo accounts...</Text></View>
      : error && !accounts.length ? <ErrorState title="Unable to load demo accounts" description={error} onRetry={() => load()} isRetrying={loading}/>
      : <FlatList data={accounts} keyExtractor={item => item.id} renderItem={renderItem} contentContainerStyle={accounts.length ? styles.list : styles.emptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[theme.colors.primary]} tintColor={theme.colors.primary}/>} ListHeaderComponent={error ? <Text style={styles.error}>{error} Pull down to retry.</Text> : null}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyIcon}>◇</Text><Text style={styles.emptyTitle}>No demo accounts yet</Text><Text style={styles.secondary}>Create the first account from DEMO-TEMPLATE.</Text></View>}/>}
    <Modal visible={showCreate} transparent animationType="slide" onRequestClose={close}><KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Pressable style={StyleSheet.absoluteFill} onPress={close}/><View style={styles.modal}><ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create Demo Account</Text><Text style={styles.modalHint}>A fresh sandbox will be copied from DEMO-TEMPLATE.</Text>
      {([['fullName','Full name *','Demo Investor'],['email','Email *','demo@example.com'],['password','Password *','At least 8 characters'],['demoCode','Demo code','Generated automatically if blank'],['expiresAt','Expires at (optional)','YYYY-MM-DD; blank means no expiration']] as const).map(([key,label,placeholder]) => <View key={key}><Text style={styles.fieldLabel}>{label}</Text><StyledInput value={form[key]} onChangeText={value => setField(key,value)} placeholder={placeholder} secureTextEntry={key === 'password'} autoCapitalize={key === 'fullName' ? 'words' : key === 'demoCode' ? 'characters' : 'none'} keyboardType={key === 'email' ? 'email-address' : 'default'} style={styles.input}/></View>)}
      <View style={styles.actions}><BlueButton title="Cancel" onPress={close} variant="gray" disabled={submitting} style={styles.action}/><BlueButton title={submitting ? 'Creating...' : 'Create from template'} onPress={create} disabled={submitting} style={styles.action}/></View>
    </ScrollView></View></KeyboardAvoidingView></Modal>
  </View>;
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:theme.colors.background}, grow:{flex:1}, top:{padding:theme.spacing.lg,flexDirection:'row',alignItems:'center'}, title:{fontSize:theme.typography.sizes.xl,fontWeight:'800',color:theme.colors.text}, secondary:{fontSize:theme.typography.sizes.sm,color:theme.colors.textSecondary}, list:{padding:theme.spacing.lg,paddingTop:0}, emptyList:{flexGrow:1,padding:theme.spacing.lg}, center:{flex:1,minHeight:280,alignItems:'center',justifyContent:'center'}, loading:{marginTop:theme.spacing.md,color:theme.colors.textSecondary}, card:{padding:theme.spacing.lg,marginBottom:theme.spacing.md,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radii.lg,backgroundColor:theme.colors.surface,elevation:2}, templateCard:{borderWidth:2,borderColor:theme.colors.warning,backgroundColor:'#FFFBEB'}, header:{flexDirection:'row',alignItems:'flex-start'}, name:{fontSize:theme.typography.sizes.lg,fontWeight:'800',color:theme.colors.text}, badge:{paddingHorizontal:10,paddingVertical:5,borderRadius:20,fontSize:theme.typography.sizes.xs,fontWeight:'800'}, active:{backgroundColor:'#DCFCE7',color:'#15803D'}, inactive:{backgroundColor:'#FEE2E2',color:'#B91C1C'}, template:{marginTop:theme.spacing.md,padding:theme.spacing.md,borderRadius:theme.radii.sm,backgroundColor:'#FEF3C7'}, templateTitle:{fontWeight:'900',color:'#92400E',letterSpacing:.8}, templateHint:{fontSize:theme.typography.sizes.xs,color:'#A16207'}, row:{marginTop:theme.spacing.md,flexDirection:'row',justifyContent:'space-between'}, code:{fontWeight:'800',color:theme.colors.info}, balance:{marginVertical:theme.spacing.md,fontSize:theme.typography.sizes.xl,fontWeight:'900',color:theme.colors.text}, meta:{marginTop:4,fontSize:theme.typography.sizes.sm,color:theme.colors.textSecondary}, expired:{color:theme.colors.danger,fontWeight:'700'}, actions:{flexDirection:'row',gap:theme.spacing.sm,marginTop:theme.spacing.lg}, action:{flex:1,marginBottom:0}, error:{padding:theme.spacing.md,marginBottom:theme.spacing.md,borderRadius:theme.radii.sm,color:theme.colors.danger,backgroundColor:'#FEF2F2'}, emptyIcon:{fontSize:48,color:theme.colors.primary}, emptyTitle:{marginBottom:theme.spacing.sm,fontSize:theme.typography.sizes.lg,fontWeight:'800',color:theme.colors.text}, overlay:{flex:1,justifyContent:'flex-end',backgroundColor:theme.colors.overlay}, modal:{maxHeight:'90%',padding:theme.spacing.xl,borderTopLeftRadius:theme.radii.xl,borderTopRightRadius:theme.radii.xl,backgroundColor:theme.colors.surface}, modalHint:{marginTop:4,marginBottom:theme.spacing.lg,color:theme.colors.textSecondary}, fieldLabel:{marginBottom:6,fontSize:theme.typography.sizes.sm,fontWeight:'700',color:theme.colors.text}, input:{height:theme.sizes.inputHeight,marginBottom:theme.spacing.md,paddingHorizontal:theme.spacing.md,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radii.md,backgroundColor:'#F9FAFB'},
});
