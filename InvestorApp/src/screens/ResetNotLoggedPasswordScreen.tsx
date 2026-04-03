import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';
import StyledInput from '../components/StyledInput';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

import successLockIcon from '../assets/images/reset2.png';

type ResetNotLoggedPasswordRouteProp = RouteProp<
  RootStackParamList,
  'ResetNotLoggedPassword'
>;

const ResetNotLoggedPasswordScreen = () => {
  const route = useRoute<ResetNotLoggedPasswordRouteProp>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const token = route.params?.token;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordsMatch = useMemo(() => {
    return !!confirmPassword && newPassword === confirmPassword;
  }, [newPassword, confirmPassword]);

  const canSubmit =
    !!token &&
    !!newPassword &&
    !!confirmPassword &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !submitting;

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }, 2200);

    return () => clearTimeout(timer);
  }, [success, navigation]);

  const goToLogin = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const handleReset = async () => {
    if (!token) {
      Alert.alert('Error', 'Reset token is missing or invalid');
      return;
    }

    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setSubmitting(true);

      await api.post('/users/reset-password', {
        token,
        newPassword,
      });

      setSuccess(true);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || 'Failed to reset password';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <View style={styles.screen}>
        <View style={styles.topHeaderNoBack}>
          <View style={styles.backButtonPlaceholder} />
          <Text style={styles.topHeaderTitle}>Reset Password</Text>
          <View style={styles.backButtonPlaceholder} />
        </View>

        <View style={styles.content}>
          <View style={styles.cardCentered}>
            <Text style={styles.successTitle}>Invalid reset link</Text>
            <Text style={styles.successSubtitle}>
              This password reset link is missing a token or is no longer valid.
            </Text>
          </View>
        </View>

        <View style={styles.bottomButtonWrap}>
          <BlueButton
            title="Go to Login"
            onPress={goToLogin}
            width="full"
            bgColor={theme.colors.primary}
            textColor={theme.colors.white}
            borderColor="transparent"
            paddingVertical={14}
          />
        </View>
      </View>
    );
  }

  if (success) {
    return (
      <View style={styles.screen}>
        <View style={styles.topHeaderNoBack}>
          <View style={styles.backButtonPlaceholder} />
          <Text style={styles.topHeaderTitle}>Password Changed!</Text>
          <View style={styles.backButtonPlaceholder} />
        </View>

        <View style={styles.content}>
          <View style={styles.cardCentered}>
            <Image
              source={successLockIcon}
              style={styles.bigIcon}
              resizeMode="contain"
            />

            <Text style={styles.successTitle}>
              Your password has been successfully updated.
            </Text>

            <Text style={styles.successSubtitle}>
              You can now log in with your new password.
            </Text>
          </View>
        </View>

        <View style={styles.bottomButtonWrap}>
          <BlueButton
            title="Go to Login"
            onPress={goToLogin}
            width="full"
            bgColor={theme.colors.primary}
            textColor={theme.colors.white}
            borderColor="transparent"
            paddingVertical={14}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topHeaderNoBack}>
        <View style={styles.backButtonPlaceholder} />
        <Text style={styles.topHeaderTitle}>Reset Password</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.contentWithBottom}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.mainTitle}>
            Enter a new password for your account
          </Text>

          <StyledInput
            style={styles.input}
            placeholder="Create a password"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />

          <Text style={styles.helperText}>
            Minimum 8 characters, letters and numbers
          </Text>

          <StyledInput
            style={styles.input}
            placeholder="Repeat password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {!!confirmPassword && (
            <Text
              style={[
                styles.matchText,
                passwordsMatch ? styles.matchSuccess : styles.matchError,
              ]}
            >
              {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomButtonWrap}>
        <BlueButton
          title={submitting ? 'Saving...' : 'Save password'}
          onPress={handleReset}
          width="full"
          disabled={!canSubmit}
          bgColor={canSubmit ? theme.colors.primary : '#A8DDC8'}
          textColor={theme.colors.white}
          borderColor="transparent"
          paddingVertical={14}
        />
      </View>
    </View>
  );
};

export default ResetNotLoggedPasswordScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F7',
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

  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },

  backButtonPlaceholder: {
    width: 36,
    height: 36,
  },

  content: {
    flex: 1,
    padding: 16,
  },

  contentWithBottom: {
    padding: 16,
    paddingBottom: 140,
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
    marginBottom: 22,
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

  helperText: {
    fontSize: 14,
    color: '#A3A3A3',
    marginTop: -2,
    marginBottom: 14,
  },

  matchText: {
    fontSize: 14,
    marginTop: -2,
  },

  matchSuccess: {
    color: theme.colors.primary,
  },

  matchError: {
    color: theme.colors.danger,
  },

  bottomButtonWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
  },
});