import React, { useState } from 'react';
import { View, Text,   StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ImageBackground } from 'react-native';
import loginBackground from '../assets/images/login.jpg';
import { useLoading } from '../contexts/LoadingContext';
import StyledInput from '../components/StyledInput';
import { getFcmToken } from '../firebase';
import BlueButton from '../components/BlueButton';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen = ({ navigation }: Props) => {
  const { setLoading } = useLoading();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      setLoading(true);
      const response = await api.post('/auth/login', { email, password });

      //const { token, ...userInfo } = response.data;
      //Alert.alert("response:" + response.data);
      //Alert.alert("token:" + token);
      //Alert.alert("userInfo:" + userInfo);
      //  await AsyncStorage.setItem('data', JSON.stringify(response.data));
      //await AsyncStorage.setItem('user', JSON.stringify(userInfo));
      //await AsyncStorage.setItem('token',JSON.stringify(userInfo.token));

      await AsyncStorage.setItem('user', JSON.stringify(response.data));

      //const user = response.data;
      // await AsyncStorage.setItem('user', JSON.stringify(user));

      const fcmToken = await getFcmToken();
      if (fcmToken) {
        try {
          await api.post('/notifications/register-token', {
            token: fcmToken,
          });
          console.log('Token registered on backend');
        } catch (err) {
          console.warn('Failed to register FCM token', err);
        }
      }

      navigation.navigate('Profile');
      setLoading(false);
    } catch (error: any) {
      let message = 'Something went wrong';
      if (error.response?.data?.message) { //if (error.response && error.response.data && error.response.data.message) {
        message = error.response.data.message;
      } else if (error.message) {
        message = error.message;
      }

      Alert.alert('Login failed', 'Invalid email or password' + message);
      setLoading(false);
    }
  };
  /*
    const testApi = async () => {
      try {
        const response = await api.get('/properties'); 
        Alert.alert('Success', JSON.stringify(response.data).slice(0, 200));
      } catch (error: any) {
        let message = 'API call failed';
        if (error.response && error.response.data) {
          message = JSON.stringify(error.response.data);
        } else if (error.message) {
          message = error.message;
        }
        Alert.alert('API Error', message);
      }
    };
  */
  return (
    <ImageBackground
      source={loginBackground}
      resizeMode="cover"
      style={styles.background}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Login to real-estate app</Text>
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
        <View style={styles.rowButtons}>
          <View style={styles.buttonContainer}>
            <BlueButton title="Login" onPress={handleLogin} />
          </View>
          <View style={styles.buttonContainer}>
            <BlueButton title="Sign up" onPress={() => navigation.navigate('Register')} />
          </View>
        </View>

        {/* <View style={{ height: 10 }} />
        <BlueButton title="Forgot Password?" onPress={() => navigation.navigate('ForgotPassword')} /> */}

        {/* <Text onPress={() => navigation.navigate('Register')} style={styles.link}>
        Don't have an account? Register
      </Text> */}
        {/* <Text onPress={() => navigation.navigate('AdminWithdrawals')} style={styles.adminLink}>
      ➤ Enter Admin Panel
    </Text> */}
        <Text onPress={async () => {
          try {
            const response = await api.post('/auth/login', {
              email: 'admin@example.com',
              password: 'securepassword',
            });
            await AsyncStorage.setItem('user', JSON.stringify(response.data));
            navigation.navigate('AdminDashboards');
          } catch (err) {
            Alert.alert('Error', 'Failed to log in as admin@example.com');
          }
        }} style={styles.adminLink}>
          ➤ Enter Admin Panel
        </Text>

        <Text onPress={async () => {
          try {

            const response = await api.post('/auth/login', {
              email: 'user@example.com',
              password: 'securepassword',
            });

            await AsyncStorage.setItem('user', JSON.stringify(response.data));

            const fcmToken = await getFcmToken();
            if (fcmToken) {
              try {
                await api.post('/notifications/register-token', {
                  token: fcmToken,
                });
                console.log('Token registered on backend');
              } catch (err) {
                console.warn('Failed to register FCM token', err);
              }
            }

            navigation.navigate('Profile');

          } catch (err) {
            Alert.alert('Error', 'Failed to log in as user@example.com');
          }
        }} style={styles.userLink}>
          ➤ Login as Test User
        </Text>

        <Text onPress={async () => {
          try {

            const response = await api.post('/auth/login', {
              email: 'user2@example.com',
              password: 'securepassword',
            });

            await AsyncStorage.setItem('user', JSON.stringify(response.data));
            navigation.navigate('Profile');

          } catch (err) {
            Alert.alert('Error', 'Failed to log in as user2@example.com');
          }
        }} style={styles.userLink2}>
          ➤ Login as Test User2
        </Text>

        <Text onPress={async () => {
          try {

            const response = await api.post('/auth/login', {
              email: 'user3@example.com',
              password: 'securepassword',
            });

            await AsyncStorage.setItem('user', JSON.stringify(response.data));
            navigation.navigate('Profile');

          } catch (err) {
            Alert.alert('Error', 'Failed to log in as user3@example.com');
          }
        }} style={styles.userLink3}>
          ➤ Login as Test User3
        </Text>

        {/* <BlueButton title="Test API" onPress={testApi} color="orange" /> */}
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, marginTop: 390 },
  title: { textShadowRadius: 1, textShadowOffset: { width: 1, height: 1 }, textShadowColor: 'white', color: 'black', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    backgroundColor: '#f0f0f0',
  },
  link: { marginTop: 10, color: 'blue', textAlign: 'center' },
  adminLink: {
    marginTop: 20,
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    padding: 20,
    borderRadius: 12,
    width: '90%',
  },
  userLink: {
    marginTop: 10,
    color: 'red',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  userLink2: {
    marginTop: 10,
    color: 'black',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  userLink3: {
    marginTop: 10,
    color: 'orange',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  rowButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginVertical: 10,
  },
  buttonContainer: {
    flex: 1,
  },
});

export default LoginScreen;
