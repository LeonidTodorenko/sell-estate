import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Dimensions,
  Text,
  StyleSheet,
  Alert,
  Platform,
  Keyboard,
  ImageBackground,
  Pressable,
  Animated,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
//import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { RootStackParamList } from '../navigation/AppNavigator';

import loginBackground from '../assets/images/login.jpg';
import onboarding1 from '../assets/images/onboarding1.png';
import onboarding2 from '../assets/images/onboarding2.png';
import onboarding3 from '../assets/images/onboarding3.png';
import onboarding4 from '../assets/images/onboarding4.png';
import onboarding5 from '../assets/images/onboarding5.png';

import inner1 from '../assets/images/inner1.png';
import inner2 from '../assets/images/inner2.png';
import inner3 from '../assets/images/inner3.png';
import inner4 from '../assets/images/inner4.png';

import { useLoading } from '../contexts/LoadingContext';
import StyledInput from '../components/StyledInput';
import { getFcmToken } from '../firebase';
//import BlueBaseButton from '../components/BlueBaseButton';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { saveSession } from '../services/sessionStorage';
import { API_BASE_URL, setAccessToken, writeLegacyUser, resetForceLogoutFlag } from '../api';
import { getRoleFromUserAndToken } from '../services/auth';
import BlueButton from '../components/BlueButton';
import Ionicons from 'react-native-vector-icons/Ionicons';

//import { AuthContext } from '../contexts/AuthContext';

//import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

type SlideItem = {
  id: number;
  title: string;
  description: string;
  image: any;
  innerImage?: any;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const slides: SlideItem[] = [
  {
    id: 1,
    title: 'Welcome\nto Owners Club!',
    description:
      'Invest in real estate, buy shares from $1,000\nand earn passive income from rent and\nproperty value growth.',
    image: onboarding1,
  },
  {
    id: 2,
    title: 'Buy shares and earn\nfrom property growth',
    description: 'Invest in promising properties and grow your\ncapital.',
    image: onboarding2,
    innerImage: inner1,
  },
  {
    id: 3,
    title: 'Buy shares and earn\nrental income',
    description: 'Monthly payments directly to your wallet.',
    image: onboarding3,
    innerImage: inner2,
  },
  {
    id: 4,
    title: 'Trade with\nother investors',
    description: 'Buy shares at favorable prices or sell yours on\nthe marketplace.',
    image: onboarding4,
    innerImage: inner3,
  },
  {
    id: 5,
    title: 'Full statistics\nand transparency',
    description: 'Track yield, portfolio growth and transaction\nhistory.',
    image: onboarding5,
    innerImage: inner4,
  },
];

const LoginScreen = ({ navigation }: Props) => {
  const { setLoading } = useLoading();
  //  const { signIn } = React.useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); // блокируем повторные тапы

  const HERO_HEIGHT = Math.round(Dimensions.get('window').height * 0.43);
  // Следим, открыта ли клавиатура
  const [kbShown, setKbShown] = useState(false);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [showLoginPanel, setShowLoginPanel] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const heroAnim = useRef(new Animated.Value(0)).current;
  const panelAnim = useRef(new Animated.Value(420)).current;

  const progressAnim = useRef(new Animated.Value(0)).current;
  const innerAnim = useRef(new Animated.Value(1)).current;

  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;
  

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKbShown(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbShown(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    resetForceLogoutFlag();
  }, []);

  useEffect(() => {
    innerAnim.setValue(0.92);

    Animated.spring(innerAnim, {
      toValue: 1,
      speed: 12,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [currentSlide, innerAnim]);

  const openLoginPanel = useCallback(() => {
    setShowLoginPanel(true);

    Animated.parallel([
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(panelAnim, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(innerAnim, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroAnim, panelAnim, innerAnim]);

  useEffect(() => {
    if (showLoginPanel) return;

    progressAnim.stopAnimation();
    progressAnim.setValue(0);

    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: 10000,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (!finished) return;

      if (currentSlide === slides.length - 1) {
        //openLoginPanel();
      } else {
        setCurrentSlide((prev) => prev + 1);
      }
    });

    return () => {
      progressAnim.stopAnimation();
    };
  }, [currentSlide, showLoginPanel, progressAnim]);

 
  const handleNextSlide = () => {
    progressAnim.stopAnimation();

    if (isLastSlide) {
      openLoginPanel();
      return;
    }

    setCurrentSlide((prev) => prev + 1);
  };

  const handleSkip = () => {
    progressAnim.stopAnimation();
    openLoginPanel();
  };

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
  const loginCore = async (
    creds: { email: string; password: string },
    goto?: keyof RootStackParamList,
  ) => {
    if (busy) return; // защита от двойного нажатия
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
      resetForceLogoutFlag();
      const fcmToken = await getFcmToken();
      if (fcmToken) {
        try {
          await axios.post(`${API_BASE_URL}/notifications/register-token`, { token: fcmToken });
        } catch (e) {
          console.warn('Failed to register FCM token', e);
        }
      }

      const role = getRoleFromUserAndToken(user, accessToken);
      const target: keyof RootStackParamList =
        goto ?? (role === 'admin' ? 'AdminDashboards' : 'Home');
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
      if (error.response?.data?.message) {
        //if (error.response && error.response.data && error.response.data.message) {
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

  const heroAnimatedStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: heroAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -SCREEN_HEIGHT * 0.25], // насколько уедет вверх
          }),
        },
      ],
    }),
    [heroAnim],
  );

  const innerAnimatedStyle = useMemo(
    () => ({
      opacity: innerAnim,
      transform: [
        {
          scale: innerAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.76, 1],
          }),
        },
        {
          translateY: innerAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-10, 0],
          }),
        },
      ],
    }),
    [innerAnim],
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* <ImageBackground
      source={loginBackground}
      resizeMode="cover"
      style={styles.background}
    > */}

      <Animated.View style={[styles.heroWrap, heroAnimatedStyle]}>
        <ImageBackground
          source={slide.image ?? loginBackground}
          resizeMode="cover"
          style={styles.heroImage}
        >
          <View style={styles.heroOverlay} />

          {!!slide.innerImage && (
            <Animated.View style={[styles.innerImageWrap, innerAnimatedStyle]}>
              <Image source={slide.innerImage} style={styles.innerImage} resizeMode="contain" />
            </Animated.View>
          )}

          {!showLoginPanel && (
            <>
              <View style={styles.topControls}></View>

              <View style={styles.progressWrap}>
                {slides.map((_, index) => {
                  const isActive = index === currentSlide;
                  const isPassed = index < currentSlide;

                  return (
                    <View key={index} style={styles.progressTrack}>
                      {isPassed ? (
                        <View style={styles.progressFillFull} />
                      ) : isActive ? (
                        <Animated.View
                          style={[
                            styles.progressFillAnimated,
                            {
                              width: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                              }),
                            },
                          ]}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <View style={styles.heroBottomContent}>
                <Text style={styles.heroTitle}>{slide.title}</Text>
                <Text style={styles.heroDescription}>{slide.description}</Text>

                <View style={styles.dotsRow}>
                  {slides.map((_, index) => (
                    <View
                      key={index}
                      style={[styles.dot, index === currentSlide && styles.dotActive]}
                    />
                  ))}
                </View>

                <View style={styles.heroButtonsRow}>
                  <BlueButton
                    title={isLastSlide ? 'Log In' : 'Next'}
                    onPress={handleNextSlide}
                    width="full"
                    showArrow={false}
                    bgColor="#10B981"
                    textColor="#FFFFFF"
                    borderColor="#10B981"
                    paddingVertical={12}
                    style={styles.heroMainButton}
                  />
                </View>
                {!isLastSlide && (
                  <Pressable onPress={handleSkip} style={styles.skipBottomBtn}>
                    <Text style={styles.skipBottomText}>Skip</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </ImageBackground>
      </Animated.View>

      {showLoginPanel && (
        <Animated.View
          style={[
            styles.loginPanelWrap,
            {
              transform: [{ translateY: panelAnim }],
            },
          ]}
        >
         <KeyboardAwareScrollView
  contentContainerStyle={styles.loginScrollContent}
  keyboardShouldPersistTaps="handled"
  enableOnAndroid
  enableAutomaticScroll
  extraScrollHeight={8}
  extraHeight={0}
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

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Log In</Text>
              <Text style={styles.panelSubtitle}>
                Enter your email and password to continue
              </Text>

              <StyledInput
                style={styles.input}
                placeholder="E-mail"
                value={email}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
              />
          <View style={styles.passwordWrap}>
  <StyledInput
    style={[styles.input, styles.passwordInput]}
    placeholder="Password"
    secureTextEntry={!showPassword}
    value={password}
    onChangeText={setPassword}
  />

  <Pressable
    onPress={() => setShowPassword((prev) => !prev)}
    style={styles.eyeButton}
    hitSlop={10}
  >
    <Ionicons
      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
      size={22}
      color="#6B7280"
    />
  </Pressable>
</View>

              <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotWrap}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>

              {/* <View
          style={[
            styles.rowButtons
            ,            { marginBottom: kbHeight > 0 ? kbHeight + 120 : 5 } // <── Динамический отступ
          ]}
        > */}
              <View style={styles.buttonContainer}>
                <BlueButton
                  title={busy ? 'Please wait...' : 'Log In'}
                  onPress={handleLogin}
                  disabled={busy}
                  width="full"
                  showArrow={false}
                  bgColor="#9AD9C1"
                  textColor="#FFFFFF"
                  borderColor="#9AD9C1"
                  paddingVertical={14}
                  style={styles.loginButton}
                />

                <Pressable onPress={() => navigation.navigate('Register')} style={styles.createWrap}>
                  <Text style={styles.createText}>
                    No account? <Text style={styles.createAccent}>Create</Text>
                  </Text>
                </Pressable>
              </View>

<Text style={styles.termsText}>
  By continuing, you agree to the{' '}
  <Text
    style={styles.termsAccent}
    onPress={() => navigation.navigate('Terms')}
  >
    Terms of Use
  </Text>
</Text>

              <View style={styles.quickLoginWrap}>
                <Text
                  onPress={() =>
                    loginCore(
                      { email: 'admin@example.com', password: 'securepassword' },
                      'AdminDashboards',
                    )
                  }
                  style={styles.adminLink}
                >
                  ➤ Enter Admin Panel
                </Text>

              

                <Text
                  onPress={() =>
                    loginCore({ email: 'user@example.com', password: 'securepassword' }, 'Home')
                  }
                  style={styles.userLink}
                >
                  ➤ Login as Test User
                </Text>

               
                <Text
                  onPress={() =>
                    loginCore({ email: 'user2@example.com', password: 'securepassword' }, 'Home')
                  }
                  style={styles.userLink2}
                >
                  ➤ Login as Test User2
                </Text>

                <Text
                  onPress={() =>
                    loginCore({ email: 'user3@example.com', password: 'securepassword' }, 'Home')
                  }
                  style={styles.userLink3}
                >
                  ➤ Login as Test User3
                </Text>

                {/* <BlueButton title="Test API" onPress={testApi} color="orange" /> */}
              </View>
            </View>

           

            {/* нижний небольшой отступ, чтобы кнопки не прилипали */}
            <View style={{ height: 24 }} />
          </KeyboardAwareScrollView>
        </Animated.View>
      )}

      {/* </ImageBackground> */}
    </View>
  );
};

const styles = StyleSheet.create({
  heroWrap: {
    flex: 1,
    backgroundColor: '#000',
  },

  heroImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },

  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.26)',
  },

  innerImageWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '7%',
    bottom: '40%',
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  innerImage: {
    width: '82%',
    maxWidth: 430,
    height: '100%',
    maxHeight: SCREEN_HEIGHT * 0.42,
  },

  topControls: {
    paddingTop: Platform.OS === 'ios' ? 58 : 24,
    paddingHorizontal: 20,
    alignItems: 'flex-end',
  },

  heroBottomContent: {
    paddingHorizontal: 24,
    paddingBottom: 42,
    zIndex: 4,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 40,
    textAlign: 'left',
  },

  heroDescription: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 14,
    marginBottom: 24,
    maxWidth: '92%',
  },

  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 18,
    display: 'none',
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
    marginRight: 8,
  },

  dotActive: {
    width: 22,
    backgroundColor: '#10B981',
  },

  heroButtonsRow: {
    marginTop: 6,
  },

  heroMainButton: {
    marginBottom: 0,
    borderRadius: 12,
    shadowOpacity: 0,
    elevation: 0,
  },

  loginPanelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },

loginScrollContent: {
  flexGrow: 1,
  justifyContent: 'flex-end',
  paddingTop: 20,
},

panel: {
  backgroundColor: '#FFFFFF',
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  paddingHorizontal: 20,
  paddingTop: 24,
  paddingBottom: Platform.OS === 'android' ? 18 : 28,
  minHeight: SCREEN_HEIGHT * 0.56,
},

  panelTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },

  panelSubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },

  container: {
    //  width: '100%',
    maxWidth: 420, // чтобы на широких экранах не растягивалось
    alignSelf: 'center',

    //  flex: 1, justifyContent: 'center', paddingHorizontal: 20, marginTop: 350
  },

  title: {
    color: 'white',
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  }, //  textShadowRadius: 1, textShadowOffset: { width: 1, height: 1 }, textShadowColor: 'white',

  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    //width:250,
  },

  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 18,
  },

  forgotText: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '600',
  },

  loginButton: {
    borderRadius: 12,
    shadowOpacity: 0,
    elevation: 0,
    marginBottom: 16,
  },

  createWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },

  createText: {
    fontSize: 16,
    color: '#9CA3AF',
  },

  createAccent: {
    color: '#10B981',
    fontWeight: '700',
  },

  termsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },

  termsAccent: {
    color: '#111827',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  quickLoginWrap: {
    marginTop: 6,
  },

  link: { marginTop: 10, color: 'blue', textAlign: 'center' },

  adminLink: {
    marginTop: 1,
    color: '#111827',
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
    marginTop: 6,
    color: 'red',
    textAlign: 'center',
    fontWeight: 'bold',
  },

  userLink2: {
    marginTop: 6,
    color: 'black',
    textAlign: 'center',
    fontWeight: 'bold',
  },

  userLink3: {
    marginTop: 6,
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

passwordWrap: {
  position: 'relative',
  justifyContent: 'center',
  marginBottom: 8,
},
passwordInput: {
  paddingRight: 46,
  marginBottom: 0,
},

eyeButton: {
  position: 'absolute',
  right: 14,
  top: 0,
  bottom: 0,
  justifyContent: 'center',
  zIndex: 5,
},

  progressWrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 24,
    left: 20,
    right: 20,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 38,
  },

  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
    marginRight: 6,
  },

  progressFillFull: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
  },

  progressFillAnimated: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
  },

  skipBottomBtn: {
    alignSelf: 'center',
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  skipBottomText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default LoginScreen;