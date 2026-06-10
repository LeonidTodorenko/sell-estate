import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import theme from '../constants/theme';

const TermsScreen = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.title}>Platform Terms of Use</Text>
        <Text style={styles.updated}>Last updated: August 2026</Text>

        <Text style={styles.text}>
          These Terms of Use govern access to and use of the OwnersClub platform, including the
          mobile application, website, and related services. By creating an account or using the
          platform, users agree to these Terms.
        </Text>

        <Text style={styles.section}>1. About the Platform</Text>
        <Text style={styles.text}>
          OwnersClub is a digital platform designed to provide real-estate related information,
          portfolio tools, investment-related functionality, transaction history, and marketplace
          features where available.
        </Text>

        <Text style={styles.section}>2. Demo and Availability of Features</Text>
        <Text style={styles.text}>
          Some features may be provided for demonstration, testing, informational, or preview
          purposes. Certain functionality, including payments, withdrawals, investment processing,
          marketplace transactions, and identity verification, may be unavailable, limited, or subject
          to additional approval.
        </Text>

        <Text style={styles.section}>3. Eligibility</Text>
        <Text style={styles.text}>
          Users must be at least 18 years old and legally capable of entering into binding agreements.
          Users are responsible for providing accurate and complete information.
        </Text>

        <Text style={styles.section}>4. Account Security</Text>
        <Text style={styles.text}>
          Users are responsible for maintaining the confidentiality of login credentials, passwords,
          PIN codes, and authentication data. Users must notify support if they suspect unauthorized
          account access.
        </Text>

        <Text style={styles.section}>5. Identity Verification</Text>
        <Text style={styles.text}>
          The platform may require identity verification, KYC checks, document review, and compliance
          procedures before certain features become available.
        </Text>

        <Text style={styles.section}>6. Investment Risks</Text>
        <Text style={styles.text}>
          Any investment involves risk. Property values may rise or fall, rental income may vary,
          projects may be delayed, and projected returns are not guaranteed. Information shown in the
          app is for informational purposes only.
        </Text>

        <Text style={styles.section}>7. No Financial Advice</Text>
        <Text style={styles.text}>
          The platform does not provide personal financial, legal, tax, or investment advice. Users
          are responsible for evaluating whether any opportunity is suitable for their own
          circumstances.
        </Text>

        <Text style={styles.section}>8. Payments and Wallet Operations</Text>
        <Text style={styles.text}>
          Wallet balances, deposits, withdrawals, rental income, internal transfers, and other
          transaction-related features may be subject to technical, banking, compliance, operational,
          or regional restrictions.
        </Text>

        <Text style={styles.section}>9. Marketplace and Share Transfers</Text>
        <Text style={styles.text}>
          Marketplace functionality, where available, may allow users to list, bid for, buy, or sell
          shares subject to platform rules, availability, pricing, moderation, cancellation fees, and
          verification checks.
        </Text>

        <Text style={styles.section}>10. User Conduct</Text>
        <Text style={styles.text}>
          Users must not misuse the platform, submit false information, attempt unauthorized access,
          upload harmful content, interfere with platform operation, or use the platform for unlawful,
          fraudulent, or abusive purposes.
        </Text>

        <Text style={styles.section}>11. Suspension and Termination</Text>
        <Text style={styles.text}>
          We may suspend, restrict, or terminate access in case of suspected fraud, legal or
          compliance concerns, breach of these Terms, misuse of the platform, or failure to complete
          required verification.
        </Text>

        <Text style={styles.section}>12. Intellectual Property</Text>
        <Text style={styles.text}>
          Platform content, software, design, graphics, logos, interfaces, and related materials are
          owned by or licensed to the platform and may not be copied, distributed, or exploited
          without permission.
        </Text>

        <Text style={styles.section}>13. Third-Party Services</Text>
        <Text style={styles.text}>
          The platform may depend on third-party services, including cloud hosting, notification
          services, payment providers, analytics, or communication tools. We are not responsible for
          third-party availability or policies.
        </Text>

        <Text style={styles.section}>14. Limitation of Liability</Text>
        <Text style={styles.text}>
          To the maximum extent permitted by law, the platform and its operators are not liable for
          indirect, incidental, consequential, special damages, lost profits, lost opportunities, data
          loss, delays, or investment losses.
        </Text>

        <Text style={styles.section}>15. Changes to the Terms</Text>
        <Text style={styles.text}>
          We may update these Terms from time to time. Continued use of the platform after changes
          means acceptance of the updated Terms.
        </Text>

        <Text style={styles.section}>16. Contact</Text>
        <Text style={styles.text}>
          For questions about these Terms, contact us through support channels available in the app
          or by email at 	investor.real.estate.app@gmail.com.
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
    paddingBottom: 40,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    color: theme.colors.text,
  },
  updated: {
    fontSize: 14,
    color: theme.colors.textSecondary || '#8E8E93',
    marginBottom: 18,
  },
  section: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    color: theme.colors.text,
  },
  text: {
    fontSize: 15,
    color: theme.colors.textSecondary || '#555',
    marginBottom: 6,
    lineHeight: 23,
  },
});