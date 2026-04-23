import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import theme from '../constants/theme';

const TermsOfUseScreen = () => {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Platform Terms of Use</Text>
        <Text style={styles.updated}>Last updated: August 2026</Text>

        <Text style={styles.paragraph}>
          These Terms of Use govern your access to and use of the Owners Club platform,
          including the mobile application, website, and related services. By creating
          an account, accessing the platform, or using any of its services, you agree to
          be bound by these Terms.
        </Text>

        <Text style={styles.sectionTitle}>1. About the Platform</Text>
        <Text style={styles.paragraph}>
          Owners Club is a digital platform designed to provide users with access to
          real-estate related investment opportunities, property information, portfolio
          tracking tools, and secondary market functionality where available.
        </Text>

        <Text style={styles.sectionTitle}>2. Eligibility</Text>
        <Text style={styles.paragraph}>
          To use the platform, you must be at least 18 years old and have the legal
          capacity to enter into binding agreements under the laws applicable in your
          jurisdiction. By registering, you confirm that the information you provide is
          accurate and complete.
        </Text>

        <Text style={styles.sectionTitle}>3. Account Registration</Text>
        <Text style={styles.paragraph}>
          You are responsible for maintaining the confidentiality of your login
          credentials, password, PIN code, and any other authentication data associated
          with your account. You are responsible for all actions performed through your
          account unless unauthorized access is caused by the platform&apos;s fault.
        </Text>

        <Text style={styles.sectionTitle}>4. Identity Verification</Text>
        <Text style={styles.paragraph}>
          The platform may require identity verification, KYC checks, document review,
          and additional compliance procedures before certain features become available,
          including investing, withdrawals, transfers, and marketplace transactions.
        </Text>

        <Text style={styles.sectionTitle}>5. Investment Risks</Text>
        <Text style={styles.paragraph}>
          Any investment involves risk. Property values may rise or fall, rental income
          may vary, projects may be delayed, and projected returns are not guaranteed.
          Information shown in the app, including expected yield, target dates,
          projected growth, and rental assumptions, is for informational purposes only
          unless explicitly stated otherwise.
        </Text>

        <Text style={styles.sectionTitle}>6. No Financial Advice</Text>
        <Text style={styles.paragraph}>
          The platform does not provide personal financial, legal, tax, or investment
          advice. Users are solely responsible for evaluating whether any opportunity is
          appropriate for their financial situation and objectives.
        </Text>

        <Text style={styles.sectionTitle}>7. Payments and Wallet Operations</Text>
        <Text style={styles.paragraph}>
          The platform may provide wallet balance functionality, deposits, withdrawals,
          internal transfers, rental income distributions, and other transaction-related
          features. Processing times may vary depending on technical, banking, or
          compliance checks.
        </Text>

        <Text style={styles.sectionTitle}>8. Marketplace and Share Transfers</Text>
        <Text style={styles.paragraph}>
          Where marketplace functionality is available, users may be able to list,
          purchase, sell, or bid for investment shares subject to platform rules,
          availability, pricing, moderation, validation checks, cancellation fees, and
          operational restrictions.
        </Text>

        <Text style={styles.sectionTitle}>9. User Conduct</Text>
        <Text style={styles.paragraph}>
          You agree not to misuse the platform, submit false information, attempt
          unauthorized access, interfere with the platform&apos;s operation, upload harmful
          content, or use the platform for unlawful, fraudulent, or abusive purposes.
        </Text>

        <Text style={styles.sectionTitle}>10. Suspension and Termination</Text>
        <Text style={styles.paragraph}>
          We may suspend, restrict, or terminate access to the platform in case of
          suspected fraud, compliance concerns, legal requirements, misuse of the
          platform, breach of these Terms, or failure to complete required verification.
        </Text>

        <Text style={styles.sectionTitle}>11. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          All platform content, including text, design, software, graphics, logos,
          interfaces, and other materials, is owned by or licensed to the platform and
          is protected by applicable intellectual property laws. You may not reproduce,
          distribute, or exploit such content without prior written permission.
        </Text>

        <Text style={styles.sectionTitle}>12. Availability of Services</Text>
        <Text style={styles.paragraph}>
          We strive to keep the platform available and accurate, but we do not guarantee
          uninterrupted access, error-free functionality, or constant availability of
          any feature. Some features may be changed, limited, or removed at any time.
        </Text>

        <Text style={styles.sectionTitle}>13. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          To the maximum extent permitted by law, the platform and its operators shall
          not be liable for indirect, incidental, consequential, or special damages,
          including lost profits, lost opportunities, data loss, delays, or investment
          losses arising from use of the platform or reliance on its content.
        </Text>

        <Text style={styles.sectionTitle}>14. Third-Party Services</Text>
        <Text style={styles.paragraph}>
          The platform may integrate with or depend on third-party services, including
          payment providers, cloud services, notification providers, or communication
          tools. We are not responsible for the availability, content, or policies of
          third-party services.
        </Text>

        <Text style={styles.sectionTitle}>15. Changes to the Terms</Text>
        <Text style={styles.paragraph}>
          We may update these Terms from time to time. Continued use of the platform
          after updated Terms become effective means you accept the revised version.
        </Text>

        <Text style={styles.sectionTitle}>16. Governing Rules</Text>
        <Text style={styles.paragraph}>
          These Terms shall be governed by the laws and regulations applicable to the
          platform operator and the relevant jurisdiction of operation, unless otherwise
          required by mandatory consumer protection laws.
        </Text>

        <Text style={styles.sectionTitle}>17. Contact</Text>
        <Text style={styles.paragraph}>
          If you have questions regarding these Terms, please contact the platform
          support team through the contact details or support channels available in the
          application.
        </Text>
      </View>
    </ScrollView>
  );
};

export default TermsOfUseScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
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
    marginTop: 18,
    marginBottom: 8,
  },

  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: theme.colors.text,
  },
});