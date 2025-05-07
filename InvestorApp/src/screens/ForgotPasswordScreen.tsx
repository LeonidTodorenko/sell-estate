import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import api from '../api';
import StyledInput from '../components/StyledInput';

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');

  const handleSubmit = async () => {
    try {
      await api.post('/users/forgot-password', email, {
        headers: { 'Content-Type': 'application/json' },
      });
      Alert.alert('Success', 'Password reset link sent to email');
    } catch {
      Alert.alert('Error', 'Failed to send reset link');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <StyledInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <Button title="Send Reset Link" onPress={handleSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  title: { fontSize: 24, textAlign: 'center', marginBottom: 20 },
  input: {
    borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5,
  },
});

export default ForgotPasswordScreen;
