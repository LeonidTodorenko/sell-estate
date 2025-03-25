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

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Profile: undefined;
  Investments: undefined;
  Properties: undefined;
  BuyShares: { propertyId: string; propertyName: string };
  Withdraw: undefined; 
};

const Stack = createNativeStackNavigator<RootStackParamList>();
 
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen}  options={{ title: 'Enter' }} />
        <Stack.Screen name="Register" component={RegisterScreen}  options={{ title: 'Register' }} />
        <Stack.Screen name="Profile" component={ProfileScreen}  options={{ title: 'Profile' }} />
        <Stack.Screen name="Investments" component={InvestmentsScreen}  options={{ title: 'Investment' }} />
        <Stack.Screen name="Properties" component={PropertyListScreen} options={{ title: 'Properties' }} />
        <Stack.Screen name="BuyShares" component={BuySharesScreen} options={{ title: 'Buy Shares' }} />
        <Stack.Screen name="Withdraw" component={WithdrawScreen} options={{ title: 'Withdraw Funds' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
