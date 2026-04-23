import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import theme from '../constants/theme';

const AboutScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        {/* Logo */}
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>OC</Text>
        </View>

        <Text style={styles.title}>OWNERS CLUB</Text>

        <Text style={styles.info}>Version: 2.5.0 (Build 1234)</Text>
        <Text style={styles.info}>Last update: 25.12.2025</Text>
        <Text style={styles.info}>Cache size: 124 MB</Text>

        {/* Clear cache */}
        <Pressable style={styles.clearBtn}>
          <Text style={styles.clearText}>Clear Cache</Text>
        </Pressable>
      </View>

      {/* Links */}
      <View style={styles.links}>
        <Pressable onPress={() => navigation.navigate('Terms')}>
          <Text style={styles.link}>Terms of Service</Text>
        </Pressable>

        <Pressable  onPress={() => navigation.navigate('PrivacyPolicy')}>
          <Text style={styles.link}>Privacy Policy</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('TermsOfUse')}>
          <Text style={styles.link}>Platform Terms of Use</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

export default AboutScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: 30,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: theme.colors.text,
  },
  info: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  clearBtn: {
    marginTop: 20,
    backgroundColor: '#eee',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  clearText: {
    color: '#555',
    fontWeight: '500',
  },
  links: {
    alignItems: 'center',
    gap: 14,
  },
  link: {
    color: '#0a8f5b',
    fontSize: 15,
    fontWeight: '500',
  },
});