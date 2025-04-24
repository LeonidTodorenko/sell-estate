import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import Captcha from '../components/Captcha';
import api from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const RegisterScreen = ({ navigation }: Props) => {
  //const [captchaToken, setCaptchaToken] = useState('');
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretWord, setSecretWord] = useState('');

  // const handleRegister = async () => {
  //   if (!fullName || !email || !password || !secretWord) {
  //     Alert.alert('Registration failed', 'All fields are required');
  //     return;
  //   }

  //   try {
  //     await api.post('/users/register', {
  //       fullName,
  //       email,
  //       password,
  //       secretWord,
  //     });
  //     Alert.alert('Registration successful', 'You can now log in');
  //     navigation.navigate('Login');
  //   } catch (err) {
  //     console.error(err);
  //     Alert.alert('Error', 'Registration failed');
  //   }
  // };

  const handleRegister = async (captchaToken: string) => {
    if (!fullName || !email || !password || !secretWord) {
      Alert.alert('Registration failed', 'All fields are required');
      return;
    }
  
    if (!captchaToken) {
      Alert.alert('CAPTCHA required', 'Please verify you are human');
      return;
    }
  
    try {
      await api.post('/users/register', {
        fullName,
        email,
        password,
        secretWord,
        captchaToken,
      });
      Alert.alert('Registration successful', 'You can now log in');
      navigation.navigate('Login');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Registration failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>
      <TextInput
        style={styles.input}
        placeholder="Full name"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Secret Word"
        value={secretWord}
        onChangeText={setSecretWord}
      />
      <Button title="Verify I'm human" onPress={() => setShowCaptcha(true)} />
      {showCaptcha && <Captcha onVerify={(token) => {
        setShowCaptcha(false);
        handleRegister(token);
      }} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
});

export default RegisterScreen;
