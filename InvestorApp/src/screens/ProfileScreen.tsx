import React, { useState } from 'react';
import { View, Text,   StyleSheet, Alert, Image, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import theme from '../constants/theme';
import api from '../api';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import BlueButton from '../components/BlueButton';


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
  const [investmentValue, setInvestmentValue] = useState<number | null>(null);
  const [totalAssets, setTotalAssets] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [marketValue, setMarketValue] = useState<number | null>(null);
  const [pendingApplicationsValue, setPendingApplicationsValue] = useState<number | null>(null);
  const [rentalIncome, setRentalIncome] = useState<number | null>(null);

  const fetchTotalAssets = async (userId: string) => {
    try {
      const res = await api.get(`/users/${userId}/total-assets`);
      setRentalIncome(res.data.rentalIncome ?? 0);
      setTotalAssets(res.data.totalAssets);
      setInvestmentValue(res.data.investmentValue);
      setWalletBalance(res.data.walletBalance);

      setMarketValue(res.data.marketValue);
      setPendingApplicationsValue(res.data.pendingApplicationsValue);
    } catch (error: any) {
      console.error('Failed to fetch total assets', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const fetchAndRefresh = async () => {
        try {
          const stored = await AsyncStorage.getItem('user');
          if (stored) {
            const parsed = JSON.parse(stored);
            setUser(parsed);
            fetchUnreadCount(parsed.userId);
            fetchTotalAssets(parsed.userId);
          } else {
            // todo add console log Alert.alert('No session', 'Please log in again');
            navigation.replace('Login');
          }
        } catch (error: any) {
          let message = error.message || 'Unexpected error loading user';
          Alert.alert('Error', 'Failed to get user ' + message);
        }
      };

      fetchAndRefresh();
    }, [navigation])
  );
  // useEffect(() => {
  //   const loadUser = async () => {
  //     try {
  //       const stored = await AsyncStorage.getItem('user');
  //       if (stored) {
  //         const parsed = JSON.parse(stored);
  //         setUser(parsed);
  //         fetchUnreadCount(parsed.userId);
  //          fetchTotalAssets(parsed.userId); 
  //       } else {
  //         Alert.alert('No session', 'Please log in again');
  //         navigation.replace('Login');
  //       }
  //     } catch (error: any) {
  //       let message = error.message || 'Unexpected error loading user';
  //       Alert.alert('Error', 'Failed to get user: ' + message);
  //     }
  //   };

  //   loadUser();
  // }, [navigation]);

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
      <Text>Wallet Balance: {walletBalance}</Text>
      {investmentValue !== null && (
        <Text>Investment Value: {investmentValue.toFixed(2)}</Text>
      )}

      {pendingApplicationsValue !== null && pendingApplicationsValue !== 0 && (
        <Text>Pending Applications: {pendingApplicationsValue.toFixed(2)}</Text>
      )}

      {marketValue !== null && marketValue !== 0 && (
        <Text>Listed on Market: {marketValue.toFixed(2)}</Text>
      )}

      {totalAssets !== null && (
        <Text style={{ fontWeight: 'bold' }}>Total Assets: {totalAssets.toFixed(2)}</Text>
      )}

      {rentalIncome !== null && rentalIncome !== 0 && (
        <Text>Rental Income: {rentalIncome.toFixed(2)}</Text>
      )}

      <View style={styles.buttons}>
        <BlueButton title="Profile" onPress={() => navigation.navigate('Personal')} />
        {/* <BlueButton title="Edit Profile" onPress={() => navigation.navigate('EditProfile')} /> */}
        <View style={{ height: 10 }} />
        <BlueButton title="Browse Properties" onPress={() => navigation.navigate('Properties')} />
        <View style={{ height: 10 }} />
        <BlueButton title="My Investments Applications" onPress={() => navigation.navigate('InvestmentApplications')} />
        <View style={{ height: 10 }} />
        <BlueButton title="My Investments" onPress={() => navigation.navigate('Investments')} />
        <View style={{ height: 10 }} />
        <BlueButton title="Withdraw Funds" onPress={() => navigation.navigate('Withdraw')} />
        <View style={{ height: 10 }} />
        <BlueButton title="My Finance" onPress={() => navigation.navigate('MyFinance')} />
        {/* <View style={{ height: 10 }} />
        <BlueButton title="Stake History" onPress={() => navigation.navigate('MyInvestments')} />  */}
        <View style={{ height: 10 }} />
        <BlueButton title="My Properties" onPress={() => navigation.navigate('MyProperties')} />
        <View style={{ height: 10 }} />
        <BlueButton title="Withdrawal History" onPress={() => navigation.navigate('MyWithdrawals')} />
        <View style={{ height: 10 }} />

        <BlueButton title="Rental Income" onPress={() => navigation.navigate('MyRentIncome')} />
        <View style={{ height: 10 }} />

        {/* <BlueButton title="Upload KYC" onPress={() => navigation.navigate('UploadKyc')} />
        <View style={{ height: 10 }} /> */}
        {/* <BlueButton title="Top Up Balance" onPress={() => navigation.navigate('TopUp')} />
        <View style={{ height: 10 }} /> */}
        {/* <BlueButton 
          title={`Inbox Messages${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          onPress={() => navigation.navigate('Inbox')}
        />
        <View style={{ height: 10 }} /> */}
        {/* <BlueButton title="Change Password" onPress={() => navigation.navigate('ChangePassword')} />
        <View style={{ height: 10 }} /> */}
        <BlueButton 
          title="Go to Share Marketplace"
          onPress={() => navigation.navigate('ShareMarketplaces')}
        />
        <View style={{ height: 10 }} />
        {/* todo подумать <BlueButton 
          title="🔐 Test Password Reset - dunno will remove"
          onPress={() => navigation.navigate('ResetPassword')}
        /> */}
        {/* <BlueButton 
            title="📜 Transaction History"
            onPress={() => navigation.navigate('UserTransactions')}
          />
        <View style={{ height: 10 }} /> */}
        <BlueButton   title="Logout" onPress={handleLogout} variant="red" />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    //backgroundColor: theme.colors.background,
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
