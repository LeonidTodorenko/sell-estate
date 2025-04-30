import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, Image, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import theme from '../constants/theme';
import api from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

interface User {
  fullName: string;
  email: string;
  walletBalance: string;
  avatarBase64: string | null;
  id: string;
}

const ProfileScreen = ({ navigation }: Props) => {
  const [user, setUser] = useState<User | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          setUser(parsed);
          fetchUnreadCount(parsed.userId);  
        } else {
          Alert.alert('No session', 'Please log in again');
          navigation.replace('Login');
        }
      } catch (error: any) {
        let message = error.message || 'Unexpected error loading user';
        Alert.alert('Error', 'Failed to get user: ' + message);
      }
    };

    loadUser();
  }, [navigation]);

  const fetchUnreadCount = async (userId: string) => {
    try {
      const res = await api.get(`/messages/unread-count/${userId}`);
      setUnreadCount(res.data.count || 0);
    } catch (error: any) {
      let message = error.message || 'Unexpected error fetching unread count';
      Alert.alert('Error', 'Failed to fetch unread count: ' + message);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      navigation.replace('Login');
    } catch (error: any) {
      let message = error.message || 'Unexpected error removing user';
      Alert.alert('Error', 'Failed to remove user: ' + message);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Loading account...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.title}>Account</Text>

      {user.avatarBase64 ? (
        <Image
          source={{ uri: user.avatarBase64 }}
          style={{ width: 120, height: 120, borderRadius: 60, alignSelf: 'center', marginBottom: 20 }}
        />
      ) : (
        <Text>No avatar</Text>
      )}

      <Text>Full Name: {user.fullName}</Text>
      <Text>Email: {user.email}</Text>
      <Text>Wallet Balance: {user.walletBalance}</Text>

      <View style={styles.buttons}>
        <Button title="Edit Profile" onPress={() => navigation.navigate('EditProfile')} />
        <View style={{ height: 10 }} />
        <Button title="Browse Properties" onPress={() => navigation.navigate('Properties')} />
        <View style={{ height: 10 }} />
        <Button title="My Investments" onPress={() => navigation.navigate('Investments')} />
        <View style={{ height: 10 }} />
        <Button title="Withdraw Funds" onPress={() => navigation.navigate('Withdraw')} />
        <View style={{ height: 10 }} />
        <Button title="Stake History" onPress={() => navigation.navigate('MyInvestments')} />
        <View style={{ height: 10 }} />
        <Button title="My Properties" onPress={() => navigation.navigate('MyProperties')} />
        <View style={{ height: 10 }} />
        <Button title="Withdrawal History" onPress={() => navigation.navigate('MyWithdrawals')} />
        <View style={{ height: 10 }} />
        <Button title="Upload KYC" onPress={() => navigation.navigate('UploadKyc')} />
        <View style={{ height: 10 }} />
        <Button title="Top Up Balance" onPress={() => navigation.navigate('TopUp')} />
        <View style={{ height: 10 }} />
        <Button
          title={`Inbox Messages${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          onPress={() => navigation.navigate('Inbox')}
        />
        <View style={{ height: 10 }} />
        <Button title="Change Password" onPress={() => navigation.navigate('ChangePassword')} />
        <View style={{ height: 10 }} />

        {/* todo подумать <Button
          title="🔐 Test Password Reset - dunno will remove"
          onPress={() => navigation.navigate('ResetPassword')}
        /> */}

        <View style={{ height: 10 }} />
        <Button title="Logout" onPress={handleLogout} color="red" />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginVertical: 20,
  },
  buttons: {
    marginTop: 10,
  },
});

export default ProfileScreen;
