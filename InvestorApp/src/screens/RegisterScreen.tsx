import React, { useEffect,useState } from 'react';
import { View, Text,  StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import StyledInput from '../components/StyledInput';
//import Captcha from '../components/Captcha';
import api from '../api';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const RegisterScreen = ({ navigation }: Props) => {
  //const [captchaToken, setCaptchaToken] = useState('');
 // const [showCaptcha, setShowCaptcha] = useState(false);
 const [pinCode, setPinCode] = useState('');
 const [captchaId, setCaptchaId] = useState<string>('');
 const [captchaExpression, setCaptchaExpression] = useState<string>('');
 const [captchaAnswer, setCaptchaAnswer] = useState<string>('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretWord, setSecretWord] = useState('');

  const [referralCode, setReferralCode] = useState('');

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

  const handleRegister = async () => {
    if (!fullName || !email || !password || !secretWord) {
      Alert.alert('Registration failed', 'All fields are required');
      return;
    }
  
    // if (!captchaToken) {
    //   Alert.alert('CAPTCHA required', 'Please verify you are human');
    //   return;
    // }
  
    try {
      await api.post('/users/register', {
        fullName,
        email,
        password,
        secretWord,
        pinCode,
        captchaId,
        captchaAnswer: parseInt(captchaAnswer, 10),
         referralCode: referralCode?.trim() || undefined,
      });
      Alert.alert('Registration successful', 'You can now check your email');
      navigation.navigate('Login');
    } catch (error: any) {
          console.error(error);
          let message = 'Registration failed';
          if (error.response?.data?.message) {
            message = error.response.data.message;
          }
          Alert.alert('Error', message);
          await loadCaptcha();
        }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);
 
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>
      <StyledInput
        style={styles.input}
        placeholder="Full name"
        value={fullName}
        onChangeText={setFullName}
      />
      <StyledInput
        style={styles.input}
        placeholder="Email"
        value={email}
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
      />
      <StyledInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
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

      {/* <View style={styles.captchaContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Text style={styles.captchaLabel}>Solve: </Text>
          <Text style={styles.captchaExpression}>{captchaExpression}</Text>
          <BlueButton title="🔁" onPress={loadCaptcha} />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Answer"
          keyboardType="numeric"
          value={captchaAnswer}
          onChangeText={setCaptchaAnswer}
        />
      </View> */}

      <View style={styles.captchaContainer}>
        <Text style={styles.captchaLabel}>Solve:</Text>
        <Text style={styles.captchaExpression}>{captchaExpression}</Text>
        <BlueButton title="🔁" onPress={loadCaptcha} />
        <StyledInput
          style={styles.input}
          placeholder="Answer"
          keyboardType="numeric"
          value={captchaAnswer}
          onChangeText={setCaptchaAnswer}
        />
      </View>
      <BlueButton title="Register" onPress={handleRegister} />
      <View style={{ height: 10 }} />
      <BlueButton title="Forgot Password?" onPress={() => navigation.navigate('ForgotPassword')} />

      {/* <BlueButton title="Verify I'm human" onPress={() => setShowCaptcha(true)} />
      {showCaptcha && <Captcha onVerify={(token) => {
        setShowCaptcha(false);
        handleRegister(token);
      }} />} */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: theme.colors.background
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
  captchaContainer: {
    marginBottom: 20,
  },
  captchaLabel: {
    fontSize: 16,
  },
  captchaExpression: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

export default RegisterScreen;
