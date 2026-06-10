import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import theme from '../constants/theme';

const PrivacyPolicyScreen = () => {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.updated}>Last updated: August 2026</Text>

        <Text style={styles.paragraph}>
          This Privacy Policy explains how OwnersClub collects, uses, stores, and protects
          personal information when users access the mobile application, website, and related
          services.
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.paragraph}>
          We may collect account information such as your name, email address, phone number,
          password-related authentication data, profile information, avatar, address, transaction
          history, wallet activity, investment applications, marketplace activity, support messages,
          device information, app version, push notification tokens, and diagnostic data.
        </Text>

        <Text style={styles.sectionTitle}>2. Identity Verification and Documents</Text>
        <Text style={styles.paragraph}>
          The platform may collect identity verification information, including uploaded documents,
          images, and KYC-related data. This information is used for compliance, fraud prevention,
          security checks, and access to certain platform features.
        </Text>

        <Text style={styles.sectionTitle}>3. Photos, Camera, and File Uploads</Text>
        <Text style={styles.paragraph}>
          The app may request access to your photo library or camera so you can upload profile
          images, property images, KYC documents, and other files required for platform
          functionality.
        </Text>

        <Text style={styles.sectionTitle}>4. How We Use Information</Text>
        <Text style={styles.paragraph}>
          We use information to create and manage accounts, provide platform features, process
          wallet and transaction-related operations, review KYC status, provide support, send
          security and service notifications, improve functionality, prevent fraud, and comply with
          legal, regulatory, accounting, and operational requirements.
        </Text>

        <Text style={styles.sectionTitle}>5. Financial and Transaction Data</Text>
        <Text style={styles.paragraph}>
          Investment activity, wallet operations, transaction history, marketplace actions, rental
          income records, deposits, withdrawals, and related platform actions may be stored for
          operational, legal, security, reporting, and compliance purposes.
        </Text>

        <Text style={styles.sectionTitle}>6. Push Notifications</Text>
        <Text style={styles.paragraph}>
          We may use push notification services, including Firebase Cloud Messaging, to send account,
          transaction, security, support, and service-related notifications.
        </Text>

        <Text style={styles.sectionTitle}>7. Data Sharing</Text>
        <Text style={styles.paragraph}>
          We do not sell personal information. Data may be shared only when necessary with service
          providers, infrastructure providers, cloud hosting providers, notification providers,
          compliance providers, payment or banking partners where applicable, and legal authorities
          when required by law or necessary to operate and protect the platform.
        </Text>

        <Text style={styles.sectionTitle}>8. Data Storage and Security</Text>
        <Text style={styles.paragraph}>
          We use reasonable technical and organizational measures to protect user information.
          However, no electronic system can guarantee absolute security.
        </Text>

        <Text style={styles.sectionTitle}>9. Data Retention</Text>
        <Text style={styles.paragraph}>
          We retain information for as long as necessary to provide services, comply with legal
          obligations, resolve disputes, prevent fraud, maintain records, and enforce agreements.
        </Text>

        <Text style={styles.sectionTitle}>10. Your Rights</Text>
        <Text style={styles.paragraph}>
          Depending on your jurisdiction, you may have the right to request access, correction,
          deletion, restriction, or portability of your personal data, subject to legal, regulatory,
          security, and operational limitations.
        </Text>

        <Text style={styles.sectionTitle}>11. Children</Text>
        <Text style={styles.paragraph}>
          The platform is not intended for users under 18 years old.
        </Text>

        <Text style={styles.sectionTitle}>12. Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. Continued use of the platform after
          updates means you accept the updated policy.
        </Text>

        <Text style={styles.sectionTitle}>13. Contact</Text>
        <Text style={styles.paragraph}>
          For privacy-related questions, contact us through the support channels available in the app
          or by email at 	investor.real.estate.app@gmail.com.
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
    marginBottom: 8,
  },
  updated: {
    fontSize: 14,
    color: theme.colors.textSecondary || '#8E8E93',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 23,
    color: theme.colors.textSecondary,
  },
});