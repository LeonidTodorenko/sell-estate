import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import AdminProtectedScreen from '../components/AdminProtectedScreen';
import theme from '../constants/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ROWS = [
  { icon: '💵', label: 'WITHDRAWALS', route: 'AdminWithdrawals' as keyof RootStackParamList },
  { icon: '👤', label: 'MANAGE USERS', route: 'AdminUsers' },
  { icon: '💼', label: 'ALL INVESTMENTS', route: 'AdminInvestments' },
  { icon: '🆔', label: 'KYC REVIEW', route: 'AdminKyc' },
  { icon: '📊', label: 'STATISTICS', route: 'AdminStats' },
  { icon: '🏠', label: 'MANAGE PROPERTIES', route: 'AdminProperties' },
  { icon: '🏠', label: 'ADMIN MESSAGES', route: 'AdminMessages' },
  { icon: '💬', label: 'USER CHATS', route: 'AdminChat' },
  { icon: '📜', label: 'ADMIN LOGS', route: 'AdminLogs' },
  { icon: '⚙️', label: 'SYSTEM PARAMETERS', route: 'AdminSystemSettings' },
  { icon: '🧑‍💻', label: 'SUPERUSER INFO', route: 'SuperUser' },
];

const AdminDashboardScreen = () => {
  const navigation = useNavigation<Nav>();

  return (
    <AdminProtectedScreen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Admin Panel</Text>

        {ROWS.map((row, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.button}
            activeOpacity={0.8}
            onPress={() => navigation.navigate(row.route as any)}
          >
            {/* Иконка слева с фиксированным отступом */}
            <Text style={styles.icon}>{row.icon}</Text>

            {/* Текст строго по центру кнопки */}
            <View style={styles.centerWrap}>
              <Text style={styles.buttonText} numberOfLines={1}>
                {row.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </AdminProtectedScreen>
  );
};

const ICON_SIZE = 18;          // визуальный размер эмодзи
const ICON_LEFT_PADDING = 16;  // отступ слева
const RESERVED_LEFT = ICON_LEFT_PADDING + ICON_SIZE + 8; // зарезервируем место под иконку

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#2a1602',
  },

  button: {
    backgroundColor: '#1e90ff',
   // borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginBottom: 16,
    // резерв под иконку слева, чтобы текст оставался по центру
    paddingLeft: RESERVED_LEFT,
    paddingRight: RESERVED_LEFT,
    elevation: 2,
  },
  icon: {
    position: 'absolute',
    left: ICON_LEFT_PADDING,
    top: '80%',
    transform: [{ translateY: -ICON_SIZE / 2 }],
    fontSize: ICON_SIZE,
  },
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#f4f4f4',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default AdminDashboardScreen;
