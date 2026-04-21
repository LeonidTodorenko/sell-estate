import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import theme from '../constants/theme';

const PrivacyPolicyScreen = () => {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Privacy Policy</Text>

        <Text style={styles.paragraph}>
          This Privacy Policy explains how the application collects, uses, stores, and protects
          your personal information when you register, use the platform, browse properties,
          invest, and interact with services inside the app.
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.paragraph}>
          We may collect your full name, email address, phone number, account credentials,
          profile information, transaction data, device information, and other data you provide
          while using the platform.
        </Text>

        <Text style={styles.sectionTitle}>2. How We Use Information</Text>
        <Text style={styles.paragraph}>
          Your information may be used to create and manage your account, process transactions,
          provide support, improve app functionality, send important notifications, comply with
          legal obligations, and protect the platform from fraud or abuse.
        </Text>

        <Text style={styles.sectionTitle}>3. Financial and Transaction Data</Text>
        <Text style={styles.paragraph}>
          Investment activity, wallet operations, transaction history, and related platform
          actions may be stored for operational, legal, security, and reporting purposes.
        </Text>

        <Text style={styles.sectionTitle}>4. Contact Information</Text>
        <Text style={styles.paragraph}>
          Your email address and phone number may be used for account verification, security
          notifications, support communication, and important service-related updates.
        </Text>

        <Text style={styles.sectionTitle}>5. Data Sharing</Text>
        <Text style={styles.paragraph}>
          We do not sell your personal information. Data may be shared only when necessary with
          service providers, infrastructure providers, legal authorities, or other parties when
          required for platform operation, compliance, fraud prevention, or user protection.
        </Text>

        <Text style={styles.sectionTitle}>6. Data Storage and Security</Text>
        <Text style={styles.paragraph}>
          We take reasonable technical and organizational measures to protect your information.
          However, no system can guarantee absolute security, and you use the service at your own
          risk.
        </Text>

        <Text style={styles.sectionTitle}>7. Your Rights</Text>
        <Text style={styles.paragraph}>
          Depending on your jurisdiction, you may have the right to request access, correction,
          or deletion of your personal data, subject to legal, operational, and regulatory
          requirements.
        </Text>

        <Text style={styles.sectionTitle}>8. Retention</Text>
        <Text style={styles.paragraph}>
          We may retain your data for as long as necessary to provide services, comply with legal
          obligations, resolve disputes, maintain security, and enforce agreements.
        </Text>

        <Text style={styles.sectionTitle}>9. Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          This Privacy Policy may be updated from time to time. Continued use of the application
          after updates means you accept the revised version.
        </Text>

        <Text style={styles.sectionTitle}>10. Contact</Text>
        <Text style={styles.paragraph}>
          If you have questions about this Privacy Policy, you may contact the platform support
          team through the available communication channels in the app.
        </Text>
      </ScrollView>
    </View>
  );
};

export default PrivacyPolicyScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 14,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 23,
    color: theme.colors.textSecondary,
  },
});