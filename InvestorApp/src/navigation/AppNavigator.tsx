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
import MyInvestmentsScreen from '../screens/MyInvestmentsScreen';
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

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Profile: undefined;
  Investments: undefined;
  Properties: undefined;
  BuyShares: { propertyId: string; propertyName: string };
  Withdraw: undefined;
  MyInvestments: undefined;
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
  InvestmentApplications: undefined;
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
        <Stack.Screen name="MyInvestments" component={MyInvestmentsScreen} options={{ title: 'My Stakes' }} />
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
        <Stack.Screen name="AdminKycUpload" component={AdminKycUploadScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="AdminLogs" component={AdminLogsScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen } />
        <Stack.Screen name="PaymentPlan" component={PaymentPlanScreen} />
        <Stack.Screen name="Inbox" component={InboxScreen} />
        <Stack.Screen name="AdminMessages" component={AdminMessagesScreen} />
        <Stack.Screen name="ShareMarketplaces" component={ShareMarketplaceScreen} />
        <Stack.Screen name="InvestmentApplications" component={InvestmentApplicationScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
