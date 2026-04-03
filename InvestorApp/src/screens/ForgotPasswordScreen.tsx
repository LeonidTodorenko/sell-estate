import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Pressable,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import api from '../api';
import StyledInput from '../components/StyledInput';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

import mailIcon from '../assets/images/reset1.png';

const ForgotPasswordScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!email.trim() && !submitting;

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    try {
      setSubmitting(true);

      await api.post('/users/forgot-password', email.trim(), {
        headers: { 'Content-Type': 'application/json' },
      });

      setSent(true);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || 'Failed to send reset link';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.screen}>
        <View style={styles.topHeaderNoBack}>
          <View style={styles.backButtonPlaceholder} />
          <Text style={styles.topHeaderTitle}>Check your email</Text>
          <View style={styles.backButtonPlaceholder} />
        </View>

        <View style={styles.content}>
          <View style={styles.cardCentered}>
            <Image
              source={mailIcon}
              style={styles.bigIcon}
              resizeMode="contain"
            />

            <Text style={styles.successTitle}>
              {`We've sent a password reset link to ${email}`}
            </Text>

            <Text style={styles.successSubtitle}>
              The link is valid for 24 hours.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* <View style={styles.topHeader}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>

        <Text style={styles.topHeaderTitle}>Forgot Password</Text>

        <View style={styles.backButtonPlaceholder} />
      </View> */}

      <ScrollView
        contentContainerStyle={styles.contentWithBottom}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.mainTitle}>
            Enter the email associated with your account.
          </Text>

          <Text style={styles.subTitle}>
            We&apos;ll send you a link to reset your password.
          </Text>

          <StyledInput
            style={styles.input}
            placeholder="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
      </ScrollView>

      <View style={styles.bottomButtonWrap}>
        <BlueButton
          title={submitting ? 'Sending...' : 'Send Link'}
          onPress={handleSubmit}
          width="full"
          disabled={!canSubmit}
          bgColor={canSubmit ? theme.colors.primary : '#A8DDC8'}
          textColor={theme.colors.white}
          borderColor="transparent"
          paddingVertical={14}
        />

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Remember your password? </Text>
          <Pressable onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Log In</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },

  topHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  topHeaderNoBack: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButtonPlaceholder: {
    width: 36,
    height: 36,
  },

  backArrow: {
    fontSize: 28,
    lineHeight: 28,
    color: theme.colors.text,
  },

  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },

  content: {
    flex: 1,
    padding: 16,
  },

  contentWithBottom: {
    padding: 16,
    paddingBottom: 150,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 16,
  },

  cardCentered: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24,
    alignItems: 'center',
  },

  bigIcon: {
    width: 118,
    height: 118,
    marginBottom: 14,
  },

  mainTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },

  subTitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#A3A3A3',
    marginBottom: 20,
  },

  successTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
    maxWidth: 320,
  },

  successSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#A3A3A3',
    textAlign: 'center',
    maxWidth: 320,
  },

  input: {
    marginBottom: 10,
    backgroundColor: '#F5F5F5',
    borderWidth: 0,
    borderRadius: 14,
  },

  bottomButtonWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    alignItems: 'center',
  },

  loginText: {
    fontSize: 16,
    color: '#A3A3A3',
  },

  loginLink: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '700',
  },
});