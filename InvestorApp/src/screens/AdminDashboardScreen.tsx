import React from 'react';
import { View, Text, Button, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

const AdminDashboardScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin Panel</Text>

      <View style={styles.buttonWrapper}>
        <Button title="💵 Withdrawals" onPress={() => navigation.navigate('AdminWithdrawals')} />
      </View>

      <View style={styles.buttonWrapper}>
        <Button title="👤 Manage Users" onPress={() => navigation.navigate('AdminUsers')} />
      </View>

      <View style={styles.buttonWrapper}>
        <Button title="💼 All Investments" onPress={() => navigation.navigate('AdminInvestments')} />
      </View>

      <View style={styles.buttonWrapper}>
        <Button title="🆔 KYC Review" onPress={() => navigation.navigate('AdminKyc')} />
      </View>

      <View style={styles.buttonWrapper}>
        <Button title="📊 Statistics" onPress={() => navigation.navigate('AdminStats')} />
      </View>

      <View style={styles.buttonWrapper}>
        <Button title="🏠 Manage Properties" onPress={() => navigation.navigate('AdminProperties')} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: '#f5f5dc',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#2a1602',
  },
  buttonWrapper: {
    marginBottom: 15,
  },
});

export default AdminDashboardScreen;
