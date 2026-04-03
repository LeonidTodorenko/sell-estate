import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import theme from '../constants/theme';

const TermsScreen = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.updated}>Last updated: 01.01.2026</Text>

        {/* Section 1 */}
        <Text style={styles.section}>1. General Provisions</Text>
        <Text style={styles.text}>
          1.1. These Terms of Service govern the relationship between Sell-Estate
          and the user of the application.
        </Text>
        <Text style={styles.text}>
          1.2. By using the app, you confirm your agreement to these terms.
        </Text>

        {/* Section 2 */}
        <Text style={styles.section}>2. Investment Platform</Text>
        <Text style={styles.text}>
          2.1. Sell-Estate provides the opportunity to purchase shares in real
          estate located in Dubai (UAE).
        </Text>
        <Text style={styles.text}>
          2.2. The minimum investment amount is $100.
        </Text>
        <Text style={styles.text}>
          2.3. Investment returns are not guaranteed and depend on market
          conditions.
        </Text>

        {/* Section 3 */}
        <Text style={styles.section}>3. User Obligations</Text>
        <Text style={styles.text}>
          3.1. The user undertakes to provide accurate data during registration.
        </Text>
        <Text style={styles.text}>
          3.2. The user is responsible for the security of their account
          credentials.
        </Text>

        {/* Section 4 */}
        <Text style={styles.section}>4. Fees and Payments</Text>
        <Text style={styles.text}>
          4.1. The platform charges fees for transactions according to the rates
          specified in the app.
        </Text>
        <Text style={styles.text}>
          4.2. Fees may vary depending on the user's level.
        </Text>
      </View>
    </ScrollView>
  );
};

export default TermsScreen;

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
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    color: theme.colors.text,
  },
  updated: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
  },
  section: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
    color: theme.colors.text,
  },
  text: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    lineHeight: 20,
  },
});