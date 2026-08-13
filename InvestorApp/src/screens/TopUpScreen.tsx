import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import api from '../api';
import StyledInput from '../components/StyledInput';
import BlueButton from '../components/BlueButton';
import DemoModeBanner from '../components/DemoModeBanner';
import theme from '../constants/theme';
import Haptics from '../services/HapticsService';
import { loadSession } from '../services/sessionStorage';

const DEMO_TOP_UP_LIMIT = 100000;

const TopUpScreen = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [pinOrPassword, setPinOrPassword] = useState('');
  const [isDemo, setIsDemo] = useState<boolean | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem('user'), loadSession()]).then(([stored, session]) => {
      const user = stored ? JSON.parse(stored) : null;
      setIsDemo(
        session?.isDemo === true || session?.user?.isDemo === true ||
        user?.isDemo === true || user?.user?.isDemo === true
      );
      setDemoCode(
        session?.demoCode ?? session?.user?.demoCode ??
        user?.demoCode ?? user?.user?.demoCode ?? null
      );
    }).catch(() => setIsDemo(false));
  }, []);

  const handleTopUp = async () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      Haptics.warning();
      return Alert.alert('Invalid', 'Enter a valid amount');
    }

    if (isDemo && parsed > DEMO_TOP_UP_LIMIT) {
      Haptics.warning();
      return Alert.alert('Limit exceeded', 'A simulated top-up cannot exceed 100,000 USD.');
    }

    if (!isDemo && !pinOrPassword) {
      Haptics.warning();
      return Alert.alert('Missing', 'Enter your PIN or password');
    }

    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored && !isDemo) {
        Haptics.error();
        return Alert.alert('Error', 'User not found');
      }

      const user = stored ? JSON.parse(stored) : {};

      if (isDemo) {
        const response = await api.post('/demo/wallet/topup', { amount: parsed });
        const newBalance = response.data.walletBalance;
        user.walletBalance = newBalance;
        if (user.user) user.user.walletBalance = newBalance;
        if (stored) await AsyncStorage.setItem('user', JSON.stringify(user));
        await queryClient.invalidateQueries({ queryKey: ['home'] });

        Haptics.success();
        setAmount('');
        Alert.alert(
          'Virtual funds added',
          `Your simulated demo balance is now $${Number(newBalance).toLocaleString()}. No real payment was made.`,
          [{ text: 'Back to Home', onPress: () => navigation.goBack() }],
        );
        return;
      }

      await api.post('/users/wallet/topup', {
          userId: user.userId,
          amount: parsed,
          pinOrPassword,
        });

      Haptics.success();
      Alert.alert('Success', 'Balance topped up');
      setAmount('');
      setPinOrPassword('');
    } catch (err) {
      console.error(err);
      Haptics.error();
      Alert.alert('Error', 'Top-up failed');
    }
  };

  if (isDemo === null) {
    return (
      <View style={[styles.container, styles.loading]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DemoModeBanner isDemo={isDemo} demoCode={demoCode} compact />
      {isDemo && (
        <Text style={styles.demoNotice}>
          Add simulated virtual funds to explore the app. No card, bank, or payment provider will be used.
        </Text>
      )}
      <Text style={styles.title}>Transfer Money</Text>
      <StyledInput
        style={styles.input}
        placeholder="Enter amount"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      {!isDemo && (
        <StyledInput
          style={styles.input}
          placeholder="PIN or Password"
          secureTextEntry
          value={pinOrPassword}
          onChangeText={setPinOrPassword}
        />
      )}
      <BlueButton title={isDemo ? 'Add Virtual Funds' : 'Transfer Money'} onPress={handleTopUp} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 ,backgroundColor: theme.colors.background},
  loading: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', display: 'none'  },
  demoNotice: {
    color: '#047857',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    lineHeight: 19,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 20,
    borderRadius: 6,
  },
});

export default TopUpScreen;
