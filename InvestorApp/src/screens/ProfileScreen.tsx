import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

interface User {
  fullName: string;
  email: string;
  walletBalance: string;
}

const ProfileScreen = ({ navigation }: Props) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        setUser(JSON.parse(stored));
      } else {
        Alert.alert('No session', 'Please log in again');
        navigation.replace('Login');
      }
    };

    loadUser();
  }, [navigation]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('user');
    navigation.replace('Login');
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Loading account...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account</Text>
      <Text>Full Name: {user.fullName}</Text>
      <Text>Email: {user.email}</Text>
      <Text>Wallet Balance: {user.walletBalance}</Text>

      <View style={styles.buttons}>
        <Button title="My Investments" onPress={() => navigation.navigate('Investments')} />
        <View style={{ height: 10 }} />
        <Button title="Withdraw Funds" onPress={() => navigation.navigate('Withdraw')}      />
        <View style={{ height: 10 }} />
        <Button title="Stake History" onPress={() => navigation.navigate('MyInvestments')} />
        <View style={{ height: 10 }} />
        <Button title="My Properties" onPress={() => navigation.navigate('MyProperties')} />
        <View style={{ height: 10 }} />
        <Button title="Withdrawal History" onPress={() => navigation.navigate('MyWithdrawals')} />
        <View style={{ height: 10 }} />
        <Button title="Logout" onPress={handleLogout} color="red" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  buttons: { marginTop: 30 },
});

export default ProfileScreen;
