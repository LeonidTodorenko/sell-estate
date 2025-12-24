import React, {   useEffect, useState } from 'react';
import { View,Dimensions, Text,   StyleSheet, Alert , Platform, Keyboard } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
//import AsyncStorage from '@react-native-async-storage/async-storage';
 import axios from 'axios';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ImageBackground } from 'react-native';
import loginBackground from '../assets/images/login.jpg';
import { useLoading } from '../contexts/LoadingContext';
import StyledInput from '../components/StyledInput';
import { getFcmToken } from '../firebase';
import BlueButton from '../components/BlueButton';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { saveSession } from '../services/sessionStorage';
import { API_BASE_URL, setAccessToken, writeLegacyUser } from '../api';
import { getRoleFromUserAndToken } from '../services/auth';
//import { AuthContext } from '../contexts/AuthContext';

//import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

 

const LoginScreen = ({ navigation }: Props) => {
  const { setLoading } = useLoading();
  //  const { signIn } = React.useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);  // блокируем повторные тапы

  const HERO_HEIGHT = Math.round(Dimensions.get('window').height * 0.43);
  // Следим, открыта ли клавиатура
  const [kbShown, setKbShown] = useState(false);
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKbShown(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbShown(false)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const currentHero = kbShown ? 200 : HERO_HEIGHT; // <— СПЕЙСЕР МЕНЬШЕ при открытой клаве

 
  // const handleLogin = async () => {
  //   try {
  //     setLoading(true);
  //    //    await signIn(email, password);
 
  //     const response = await api.post('/auth/login', { email, password });
  //     //await AsyncStorage.setItem('user', JSON.stringify(response.data));
      

  //     const { accessToken, refreshToken, user } = response.data;
  //     await saveSession({ accessToken, refreshToken, user });
  //     setAccessToken(accessToken);

  //       // ДЛЯ ЛЕГАСИ: записать старый формат
  //             await writeLegacyUser(response.data);

  //     const fcmToken = await getFcmToken();
  //     if (fcmToken) {
  //       try {
  //         // const { api } = await import('../services/http');
  //         await api.post('/notifications/register-token', {
  //           token: fcmToken,
  //         });
  //         console.log('Token registered on backend');
  //       } catch (err) {
  //         console.warn('Failed to register FCM token', err);
  //       }
  //     }

  //         const role = user?.role ?? user?.Role ?? 'user';

  //     // важный момент: RESET, чтобы кнопка "Назад" не возвращала на Login
  //     navigation.reset({
  //       index: 0,
  //       routes: [{ name: role === 'admin' ? 'AdminDashboards' : 'Home' } as any],
  //     });
  //    //navigation.navigate('Home');
  //     setLoading(false);
  //   } catch (error: any) {
  //     let message = 'Something went wrong';
  //     if (error.response?.data?.message) { //if (error.response && error.response.data && error.response.data.message) {
  //       message = error.response.data.message;
  //     } else if (error.message) {
  //       message = error.message;
  //     }

  //     Alert.alert('Login failed', 'Invalid email or password' + message);
  //     setLoading(false);
  //   }
  // };

   // ----- единая функция логина, которой пользуются и обычная кнопка, и «быстрые» ссылки -----
  const loginCore = async (creds: { email: string; password: string }, goto?: keyof RootStackParamList) => {
    if (busy) return;            // защита от двойного нажатия
    setBusy(true);
    Keyboard.dismiss();
    setLoading(true);
    try {
      // КЛЮЧЕВОЕ: идём напрямую, минуя интерсепторы api-инстанса
      const { data } = await axios.post(`${API_BASE_URL}/auth/login`, creds, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      const { accessToken, refreshToken, user } = data;
      setAccessToken(accessToken);
      await Promise.all([
        saveSession({ accessToken, refreshToken, user }),
        writeLegacyUser(data), // чтобы старые места, читающие AsyncStorage('user'), были счастливы
      ]);

        const fcmToken = await getFcmToken();
      if (fcmToken) {
        try {
          await axios.post(`${API_BASE_URL}/notifications/register-token`, { token: fcmToken });
        } catch (e) {
          console.warn('Failed to register FCM token', e);
        }
      }

            const role = getRoleFromUserAndToken(user, accessToken);
      const target: keyof RootStackParamList = goto ?? (role === 'admin' ? 'AdminDashboards' : 'Home');
      navigation.reset({ index: 0, routes: [{ name: target }] });

    

//       (async () => {
//   try {
//     let fcmToken: string | null = null;
//     try {
//       fcmToken = await getFcmToken();
//     } catch (e: any) {
//       const msg = String(e?.message ?? e);
//       if (/Cannot generate keys with required security guarantees/i.test(msg)) {
//         console.warn('FCM keygen issue, will skip this time');
//         fcmToken = null; // просто пропускаем
//       } else {
//         console.warn('getFcmToken failed:', e);
//         fcmToken = null;
//       }
//     }

//     if (fcmToken) {
//       try {
//         await axios.post(`${API_BASE_URL}/notifications/register-token`, { token: fcmToken });
//       } catch (e) {
//         console.warn('Failed to register FCM token:', e);
//         Alert.alert('Failed to register FCM token:');
//       }
//     }
//   } catch {}
// })();

      
  //     const safeRole =
  // (typeof getRoleFromUserAndToken === 'function'
  //   ? getRoleFromUserAndToken(user, accessToken)
  //   : (user?.role ?? user?.Role ?? 'user')
  // ).toLowerCase();

      //const role = user?.role ?? user?.Role ?? 'user';

      
      
 
   } catch (error: any) {
      let message = 'Something went wrong';
      if (error.response?.data?.message) { //if (error.response && error.response.data && error.response.data.message) {
        message = error.response.data.message;
      } else if (error.message) {
        message = error.message;
      }

      Alert.alert('Login failed', 'Error: ' + message);
      setLoading(false);
    } finally {
      setLoading(false);
      setBusy(false);
    }
  };

   const handleLogin = () => loginCore({ email, password });

 
  return (
       <View style={{ flex: 1 }}>
        
           {/* <ImageBackground
      source={loginBackground}
      resizeMode="cover"
      style={styles.background}
    > */}
            <ImageBackground source={loginBackground} resizeMode="cover" style={StyleSheet.absoluteFillObject} />

    <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        enableOnAndroid
           enableAutomaticScroll={true}    
        extraScrollHeight={32} // небольшой доп. отступ над клавиатурой
           extraHeight={Platform.OS === 'android' ? 140 : 0}
             showsVerticalScrollIndicator={false}
      >
      {/* <KeyboardAvoidingView      style={{ flex: 1 }}       behavior={Platform.OS === 'ios' ? 'padding' : 'height'}      >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}> */}
       
    
 
         {/* <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          > */}

             {/* <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.scrollContent,
                // добавляем нижний отступ = высота клавиатуры, чтобы докрутить до кнопок
               { paddingBottom: (kbHeight || 0) + 20 } // чтобы докручивать до кнопок
              ]}
            >  */}

   <View style={{ height: currentHero  }} />
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to real estate app</Text>
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
       {/* <View
          style={[
            styles.rowButtons
            ,            { marginBottom: kbHeight > 0 ? kbHeight + 120 : 5 } // <── Динамический отступ
          ]}
        > */}
                  <View style={styles.buttonContainer}>
           <BlueButton title={busy ? 'Please wait...' : 'Login'} onPress={handleLogin} disabled={busy} />
            <BlueButton additionalPadding={0} title="Sign up" onPress={() => navigation.navigate('Register')} />
         </View> 
       

           <Text
            onPress={() => loginCore({ email: 'admin@example.com', password: 'securepassword' }, 'AdminDashboards')}
            style={styles.adminLink}
          >
            ➤ Enter Admin Panel
          </Text>

        {/* <Text onPress={async () => {
          try {
            const response = await api.post('/auth/login', {
              email: 'admin@example.com',
              password: 'securepassword',
            });
      
             const { accessToken, refreshToken, user } = response.data;
            await saveSession({ accessToken, refreshToken, user });
            setAccessToken(accessToken);

            // ДЛЯ ЛЕГАСИ: записать старый формат
              await writeLegacyUser(response.data);

          navigation.reset({ index: 0, routes: [{ name: 'AdminDashboards' } as any] });
          } catch (err) {
            Alert.alert('Error', 'Failed to log in as admin@example.com');
          }
        }} style={styles.adminLink}>
          ➤ Enter Admin Panel
        </Text> */}


     <Text
            onPress={() => loginCore({ email: 'user@example.com', password: 'securepassword' }, 'Home')}
            style={styles.userLink}
          >
            ➤ Login as Test User
          </Text>

        {/* <Text onPress={async () => {
          try {

            const response = await api.post('/auth/login', {
              email: 'user@example.com',
              password: 'securepassword',
            });

          //  await AsyncStorage.setItem('user', JSON.stringify(response.data));

             const { accessToken, refreshToken, user } = response.data;
              await saveSession({ accessToken, refreshToken, user });
              setAccessToken(accessToken);
     
                // ДЛЯ ЛЕГАСИ: записать старый формат
              await writeLegacyUser(response.data);

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

            navigation.navigate('Home');
            

          } catch (err) {
            Alert.alert('Error', 'Failed to log in as user@example.com');
          }
        }} style={styles.userLink}>
          ➤ Login as Test User
        </Text> */}

         <Text
            onPress={() => loginCore({ email: 'user2@example.com', password: 'securepassword' }, 'Home')}
            style={styles.userLink2}
          >
            ➤ Login as Test User2
          </Text>

         <Text
            onPress={() => loginCore({ email: 'user3@example.com', password: 'securepassword' }, 'Home')}
            style={styles.userLink3}
          >
            ➤ Login as Test User3
          </Text>

        {/* <BlueButton title="Test API" onPress={testApi} color="orange" /> */}
      </View>
      
          
       
              {/* </ScrollView>  */}

           {/* <View
              style={[
                styles.footerButtons,
                { paddingBottom: Math.max(insets.bottom, kbHeight > 0 ? 8 : 16) }
              ]}
            >
              <View style={styles.buttonContainer}>
                <BlueButton title="Login" onPress={handleLogin} width="full" />
              </View>
              <View style={styles.spacer} />
              <View style={styles.buttonContainer}>
                <BlueButton title="Sign up" onPress={() => navigation.navigate('Register')} width="full" />
              </View>
            </View> */}

   
    
          {/* </TouchableWithoutFeedback>
    </KeyboardAvoidingView> */}

        {/* нижний небольшой отступ, чтобы кнопки не прилипали */}
        <View style={{ height: 24 }} />

</KeyboardAwareScrollView>
 {/* </ImageBackground> */}
 
</View>
  );
};

const styles = StyleSheet.create({
    scrollContent: {
    flexGrow: 1,
    alignItems: 'center',     
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  container: {
     //  width: '100%',
    maxWidth: 420,            // чтобы на широких экранах не растягивалось
    alignSelf: 'center',
    
    //  flex: 1, justifyContent: 'center', paddingHorizontal: 20, marginTop: 350
    },
  title: { textShadowRadius: 1, textShadowOffset: { width: 1, height: 1 }, textShadowColor: 'white', color: 'black', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 5,
    borderRadius: 5,
    backgroundColor: '#f0f0f0',
    //width:250,
    
  },
  link: { marginTop: 10, color: 'blue', textAlign: 'center' },
  adminLink: {
    marginTop: 1,
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
    footerButtons: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0, // будет поднят paddingBottom-ом, когда kb открыта
    backgroundColor: 'rgba(255,255,255,0.7)', // чтобы на фоне картинки было читаемо
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
   
  spacer: { width: 10 },
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
    marginTop: 1,
    color: 'red',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  userLink2: {
    marginTop: 1,
    color: 'black',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  userLink3: {
    marginTop: 1,
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
    //width:250,
   // flex: 1,
    // marginTop: 8,
    // marginBottom: 12,
  },
});

export default LoginScreen;
