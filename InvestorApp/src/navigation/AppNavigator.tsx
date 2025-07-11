// src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ProfileScreen from '../screens/ProfileScreen';
import InvestmentsScreen from '../screens/InvestmentsScreen';
import PropertyListScreen from '../screens/PropertyListScreen';
import BuySharesScreen from '../screens/BuySharesScreen';
import WithdrawScreen from '../screens/WithdrawScreen';
import MyPropertiesScreen from '../screens/MyPropertiesScreen';
import MyWithdrawalsScreen from '../screens/MyWithdrawalsScreen';
import AdminWithdrawalsScreen from '../screens/AdminWithdrawalsScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';
import AdminInvestmentsScreen from '../screens/AdminInvestmentsScreen';
import AdminKycScreen from '../screens/AdminKycScreen';
import AdminStatsScreen from '../screens/AdminStatsScreen';
import AdminPropertiesScreen from '../screens/AdminPropertiesScreen';
import PropertyFormScreen from '../screens/PropertyFormScreen';
import PropertyDetailScreen from '../screens/PropertyDetailScreen';
import UploadKycScreen from '../screens/UploadKycScreen';
import TopUpScreen from '../screens/TopUpScreen';
import PropertyMapScreen from '../screens/PropertyMapScreen';
import UserKycViewScreen from '../screens/UserKycViewScreen';
import AdminKycUploadScreen from '../screens/AdminKycUploadScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import AdminLogsScreen from '../screens/AdminLogsScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen  from '../screens/ResetPasswordScreen';
import PaymentPlanScreen from '../screens/PaymentPlanScreen';
import InboxScreen from '../screens/InboxScreen';
import AdminMessagesScreen from '../screens/AdminMessagesScreen';
import ShareMarketplaceScreen from '../screens/ShareMarketplaceScreen';
import InvestmentApplicationScreen from '../screens/InvestmentApplicationScreen';
import SellMyShareScreen from '../screens/SellMySharesScreen';
import AdminSystemSettingsScreen from '../screens/AdminSystemSettingsScreen';
import TradeHistoryScreen from '../screens/TradeHistoryScreen';
import SuperUserScreen from '../screens/SuperUserScreen';
import UserTransactionsScreen from '../screens/UserTransactionsScreen';
import PersonalScreen from '../screens/PersonalScreen';
import ChatScreen from '../screens/ChatScreen';
import AdminChatScreen  from '../screens/AdminChatScreen';
import MyInvestmentsScreen  from '../screens/MyInvestmentsScreen';
import MyFinanceScreen  from '../screens/MyFinanceScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Profile: undefined;
  Investments: undefined;
  Properties: undefined;
  BuyShares: { propertyId: string; propertyName: string };
  Withdraw: undefined;
  MyProperties: undefined;
  MyWithdrawals: undefined;
  AdminWithdrawals: undefined;
  AdminDashboards: undefined;
  AdminUsers: undefined;
  AdminInvestments: undefined;
  AdminKyc: undefined;
  AdminStats: undefined;
  AdminProperties: undefined;
  PropertyForm: { property?: any } | undefined;
  PropertyDetail: { propertyId: string };
  UploadKyc: undefined;
  TopUp: undefined;
  PropertyMap: { latitude: number; longitude: number; title: string };
  UserKycView: { userId: string };
  AdminKycUpload: { userId: string };
  EditProfile: undefined;
  ChangePassword: undefined;
  AdminLogs: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  PaymentPlan: { propertyId: string, readonly: boolean };
  Inbox: undefined;
  AdminMessages: undefined;
  ShareMarketplaces: undefined;
  InvestmentApplications: { propertyId: string };
  AdminSystemSettings: undefined;
  SellMyShares: { propertyId: string; propertyName: string };
  TradeHistory: undefined;
  SuperUser: undefined;
  UserTransactions: undefined;
  Personal: undefined;
  Chat: undefined;
  AdminChat: undefined;
  MyInvestments: undefined;
  MyFinance: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen}  options={{ title: 'Enter' }} />
        <Stack.Screen name="Register" component={RegisterScreen}  options={{ title: 'Register' }} />
        <Stack.Screen name="Profile" component={ProfileScreen}  options={{ title: 'Account' }} />
        <Stack.Screen name="Investments" component={InvestmentsScreen}  options={{ title: 'Stake' }} />
        <Stack.Screen name="Properties" component={PropertyListScreen} options={{ title: 'Properties' }} />
        <Stack.Screen name="BuyShares" component={BuySharesScreen} options={{ title: 'Buy Shares' }} />
        <Stack.Screen name="Withdraw" component={WithdrawScreen} options={{ title: 'Withdraw Funds' }} />
        <Stack.Screen name="MyProperties" component={MyPropertiesScreen} options={{ title: 'My Properties' }} />
        <Stack.Screen name="MyWithdrawals" component={MyWithdrawalsScreen} options={{ title: 'My Withdrawals' }} />
        <Stack.Screen name="AdminWithdrawals" component={AdminWithdrawalsScreen} options={{ title: 'Withdrawal Admin' }} />
        <Stack.Screen name="AdminDashboards" component={AdminDashboardScreen} options={{ title: 'Dashboard Admin' }} />
        <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'Admin: Users' }} />
        <Stack.Screen name="AdminInvestments" component={AdminInvestmentsScreen} options={{ title: 'Admin: Investments' }} />
        <Stack.Screen name="AdminKyc" component={AdminKycScreen} options={{ title: 'Admin: KYC' }} />
        <Stack.Screen name="AdminStats" component={AdminStatsScreen} options={{ title: 'Admin Stats' }} />
        <Stack.Screen name="AdminProperties" component={AdminPropertiesScreen} options={{ title: 'Admin: Properties' }} />
        <Stack.Screen name="PropertyForm" component={PropertyFormScreen} options={{ title: 'Property Form' }} />
        <Stack.Screen name="PropertyDetail" component={PropertyDetailScreen} options={{ title: 'Property details' }} />
        <Stack.Screen name="UploadKyc" component={UploadKycScreen} options={{ title: 'Upload KYC' }} />
        <Stack.Screen name="TopUp" component={TopUpScreen} options={{ title: 'Top Up Balance' }} />
        <Stack.Screen name="PropertyMap" component={PropertyMapScreen} options={{ title: 'Map' }} />
        <Stack.Screen name="UserKycView" component={UserKycViewScreen} options={{ title: 'User Kyc' }} />
        <Stack.Screen name="AdminKycUpload" component={AdminKycUploadScreen} options={{ title: 'Admin Kyc Upload' }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile ' }} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
        <Stack.Screen name="AdminLogs" component={AdminLogsScreen} options={{ title: 'Admin Logs' }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen } options={{ title: 'Reset Password' }}/>
        <Stack.Screen name="PaymentPlan" component={PaymentPlanScreen} options={{ title: 'Payment Plan' }} />
        <Stack.Screen name="Inbox" component={InboxScreen} options={{ title: 'Inbox' }}/>
        <Stack.Screen name="AdminMessages" component={AdminMessagesScreen} options={{ title: 'Admin Messages' }}/>
        <Stack.Screen name="ShareMarketplaces" component={ShareMarketplaceScreen} options={{ title: 'Share Market places' }}/>
        <Stack.Screen name="InvestmentApplications" component={InvestmentApplicationScreen} options={{ title: 'Investment Applications' }}/>
        <Stack.Screen name="SellMyShares" component={SellMyShareScreen} options={{ title: 'Sell My Shares' }}/>
        <Stack.Screen name="AdminSystemSettings" component={AdminSystemSettingsScreen} options={{ title: 'Admin System Settings' }}/>
        <Stack.Screen name="TradeHistory" component={TradeHistoryScreen} options={{ title: 'Trade History' }} />
        <Stack.Screen name="SuperUser" component={SuperUserScreen} options={{ title: 'Super User' }} />
        <Stack.Screen name="UserTransactions" component={UserTransactionsScreen} options={{ title: 'Transactions' }} />
        <Stack.Screen name="Personal" component={PersonalScreen} options={{ title: 'Personal' }}/>
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }}/>
        <Stack.Screen name="AdminChat" component={AdminChatScreen} options={{ title: 'Chat' }}/>
        <Stack.Screen name="MyInvestments" component={MyInvestmentsScreen} options={{ title: 'Stack history' }}/>
        <Stack.Screen name="MyFinance" component={MyFinanceScreen} options={{ title: 'My Finance' }}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
