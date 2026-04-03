import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import StyledInput from '../components/StyledInput';
import api from '../api';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const RegisterScreen = ({ navigation }: Props) => {
  const [pinCode, setPinCode] = useState('');
  const [captchaId, setCaptchaId] = useState<string>('');
  const [captchaExpression, setCaptchaExpression] = useState<string>('');
  const [captchaAnswer, setCaptchaAnswer] = useState<string>('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [secretWord, setSecretWord] = useState('');
  const [referralCode, setReferralCode] = useState('');

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [showVerificationNotice, setShowVerificationNotice] = useState(false);

  const fullName = useMemo(() => {
    return `${firstName.trim()} ${lastName.trim()}`.trim();
  }, [firstName, lastName]);

  const loadCaptcha = async () => {
    try {
      const res = await api.get('/captcha/generate');
      setCaptchaId(res.data.id);
      setCaptchaExpression(res.data.expression);
      setCaptchaAnswer('');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load CAPTCHA');
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

  const handleRegister = async () => {
    if (!acceptTerms) {
      Alert.alert('Registration failed', 'Please accept the Terms to continue');
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phoneNumber.trim() || !password || !repeatPassword || !secretWord.trim()) {
      Alert.alert('Registration failed', 'Please fill in all required fields');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Registration failed', 'Password must be at least 8 characters');
      return;
    }

    if (password !== repeatPassword) {
      Alert.alert('Registration failed', 'Passwords do not match');
      return;
    }

    if (pinCode && !/^\d{4}$/.test(pinCode)) {
      Alert.alert('Registration failed', 'PIN code must contain exactly 4 digits');
      return;
    }

    if (!captchaAnswer.trim()) {
      Alert.alert('Registration failed', 'Please solve the CAPTCHA');
      return;
    }

    try {
      setSubmitting(true);

      await api.post(
        '/users/register',
        {
          fullName,
          email,
          password,
          secretWord,
          pinCode: pinCode?.trim() || undefined,
          captchaId,
          captchaAnswer: parseInt(captchaAnswer, 10),
          referralCode: referralCode?.trim() || undefined,
          phoneNumber, // если бэк пока не использует — ASP.NET обычно просто проигнорирует лишнее поле
        },
        { timeout: 60000 }
      );

      setShowVerificationNotice(true);
    } catch (error: any) {
      console.error(error);

      let message = 'Registration failed';
      if (error.response?.data?.message) {
        message = error.response.data.message;
      }

      Alert.alert('Error', message);
      await loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  const handleFakeVerifyEmail = () => {
    Alert.alert('Verification', 'Email verification flow will be connected here.');
  };

  const handleFakeVerifyPhone = () => {
    Alert.alert('Verification', 'Phone verification flow will be connected here.');
  };

  if (showVerificationNotice) {
    return (
      <View style={styles.screen}>
        <View style={styles.topHeader}>
          <Pressable onPress={() => setShowVerificationNotice(false)} style={styles.backButton}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>

          <Text style={styles.topHeaderTitle}>Contact Verification</Text>

          <View style={styles.backButtonPlaceholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.noticeTitle}>
              For your investment security, both email and phone need to be verified
            </Text>

            <View style={styles.readonlyField}>
              <Text style={styles.readonlyLabel}>E-mail</Text>
              <Text style={styles.readonlyValue}>{email}</Text>
            </View>

            <Pressable onPress={handleFakeVerifyEmail} style={styles.verifyLinkWrap}>
              <Text style={styles.verifyLink}>Verify email</Text>
            </Pressable>

            <View style={styles.readonlyField}>
              <Text style={styles.readonlyLabel}>Phone Number</Text>
              <Text style={styles.readonlyValue}>{phoneNumber}</Text>
            </View>

            <Pressable onPress={handleFakeVerifyPhone} style={styles.verifyLinkWrap}>
              <Text style={styles.verifyLink}>Verify phone</Text>
            </Pressable>

            <Text style={styles.rulesTitle}>Without both contacts verified:</Text>

            <View style={styles.ruleRow}>
              <Text style={styles.ruleIconSuccess}>✓</Text>
              <Text style={styles.ruleText}>Property viewing available</Text>
            </View>

            <View style={styles.ruleRow}>
              <Text style={styles.ruleIconSuccess}>✓</Text>
              <Text style={styles.ruleText}>Investments up to $1,000 available</Text>
            </View>

            <View style={styles.ruleRow}>
              <Text style={styles.ruleIconDanger}>✕</Text>
              <Text style={styles.ruleText}>Withdrawals unavailable</Text>
            </View>

            <View style={styles.ruleRow}>
              <Text style={styles.ruleIconDanger}>✕</Text>
              <Text style={styles.ruleText}>Investments over $1,000 unavailable</Text>
            </View>

            <View style={styles.ruleRow}>
              <Text style={styles.ruleIconDanger}>✕</Text>
              <Text style={styles.ruleText}>P2P trading unavailable</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomButtonWrap}>
          <BlueButton
            title="Continue to app"
            onPress={() => navigation.navigate('Login')}
            width="full"
            bgColor="#EAEAEA"
            textColor={theme.colors.text}
            borderColor="#EAEAEA"
            paddingVertical={14}
          />
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

        <Text style={styles.topHeaderTitle}>Create Account</Text>

        <View style={styles.backButtonPlaceholder} />
      </View> */}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.formTitle}>Enter your details</Text>

          <StyledInput
            style={styles.input}
            placeholder="First Name"
            value={firstName}
            onChangeText={setFirstName}
          />

          <StyledInput
            style={styles.input}
            placeholder="Last Name"
            value={lastName}
            onChangeText={setLastName}
          />

          <StyledInput
            style={styles.input}
            placeholder="E-mail"
            value={email}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
          />

          <StyledInput
            style={styles.input}
            placeholder="Phone Number"
            value={phoneNumber}
            keyboardType="phone-pad"
            onChangeText={setPhoneNumber}
          />

          <StyledInput
            style={styles.input}
            placeholder="Create a password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Text style={styles.helperText}>
            Minimum 8 characters, letters and numbers
          </Text>

          <StyledInput
            style={styles.input}
            placeholder="Repeat password"
            secureTextEntry
            value={repeatPassword}
            onChangeText={setRepeatPassword}
          />
          {!!repeatPassword && (
            <Text
              style={[
                styles.helperText,
                password === repeatPassword ? styles.helperSuccess : styles.helperDanger,
              ]}
            >
              {password === repeatPassword ? 'Passwords match' : 'Passwords do not match'}
            </Text>
          )}

          <StyledInput
            style={styles.input}
            placeholder="Secret Word"
            value={secretWord}
            onChangeText={setSecretWord}
          />

          <StyledInput
            style={styles.input}
            placeholder="Referral code (optional)"
            value={referralCode}
            onChangeText={setReferralCode}
          />

          <StyledInput
            style={styles.input}
            placeholder="PIN Code (optional, 4 digits)"
            keyboardType="numeric"
            maxLength={4}
            value={pinCode}
            onChangeText={setPinCode}
          />

          <View style={styles.captchaBox}>
            <Text style={styles.captchaLabel}>Solve:</Text>
            <Text style={styles.captchaExpression}>{captchaExpression}</Text>

            <View style={styles.refreshButtonWrap}>
              <BlueButton
                title="🔁"
                onPress={loadCaptcha}
                bgColor="#F3F4F6"
                textColor={theme.colors.text}
                borderColor="#F3F4F6"
                paddingVertical={10}
                paddingHorizontal={14}
              />
            </View>

            <StyledInput
              style={styles.input}
              placeholder="Answer"
              keyboardType="numeric"
              value={captchaAnswer}
              onChangeText={setCaptchaAnswer}
            />
          </View>

          <Pressable
            onPress={() => setAcceptTerms((v) => !v)}
            style={styles.termsRow}
          >
            <View style={[styles.checkbox, acceptTerms && styles.checkboxActive]}>
              {acceptTerms ? <Text style={styles.checkboxTick}>✓</Text> : null}
            </View>

            <Text style={styles.termsText}>
              I agree to the <Text style={styles.link}>Terms of Use</Text> and{' '}
              <Text style={styles.link}>Privacy Policy</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.bottomButtonWrap}>
        <BlueButton
          title={submitting ? 'Signing Up...' : 'Sign Up'}
          onPress={handleRegister}
          width="full"
          disabled={submitting}
          bgColor={
            acceptTerms &&
            firstName.trim() &&
            lastName.trim() &&
            email.trim() &&
            phoneNumber.trim() &&
            password &&
            repeatPassword &&
            password === repeatPassword
              ? theme.colors.primary
              : '#A8DDC8'
          }
          textColor={theme.colors.white}
          borderColor="transparent"
          paddingVertical={14}
        />

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <Pressable onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Log In</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default RegisterScreen;

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
    padding: 0,
    paddingBottom: 140,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 16,
  },

  formTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 20,
  },

  input: {
    marginBottom: 10,
    backgroundColor: '#F5F5F5',
    borderWidth: 0,
    borderRadius: 14,
    paddingLeft:10,
  },

  helperText: {
    fontSize: 14,
    color: '#A3A3A3',
    marginTop: -2,
    marginBottom: 14,
  },

  helperSuccess: {
    color: theme.colors.primary,
  },

  helperDanger: {
    color: theme.colors.danger,
  },

  captchaBox: {
    marginTop: 6,
    marginBottom: 6,
  },

  captchaLabel: {
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 6,
    fontWeight: '500',
  },

  captchaExpression: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
  },

  refreshButtonWrap: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },

  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 4,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C9C9C9',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },

  checkboxActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },

  checkboxTick: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  termsText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#8E8E93',
  },

  link: {
    color: theme.colors.text,
    textDecorationLine: 'underline',
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

  noticeTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 20,
  },

  readonlyField: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
  },

  readonlyLabel: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 4,
  },

  readonlyValue: {
    fontSize: 17,
    color: theme.colors.text,
    fontWeight: '500',
  },

  verifyLinkWrap: {
    alignSelf: 'flex-end',
    marginBottom: 18,
  },

  verifyLink: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '500',
  },

  rulesTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 8,
    marginBottom: 14,
  },

  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  ruleIconSuccess: {
    width: 20,
    fontSize: 14,
    color: theme.colors.primary,
    textAlign: 'center',
    marginRight: 10,
  },

  ruleIconDanger: {
    width: 20,
    fontSize: 14,
    color: '#F199A3',
    textAlign: 'center',
    marginRight: 10,
  },

  ruleText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.text,
  },
});