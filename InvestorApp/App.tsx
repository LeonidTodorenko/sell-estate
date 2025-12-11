import React, { useEffect } from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import theme from './src/constants/theme';
import { LoadingProvider } from './src/contexts/LoadingContext';
import { requestUserPermission, getFcmToken } from './src/firebase';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { AuthProvider } from './src/contexts/AuthContext';

export default function App() {
  useEffect(() => {
    const setup = async () => {
      await requestUserPermission();
      await getFcmToken();

      // Create a channel for Android
      await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
      });
    };

    setup();

    // Handling push notifications when the app is active
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('Push received in foreground:', remoteMessage);

      await notifee.displayNotification({
        title: remoteMessage.notification?.title || 'New Notification',
        body: remoteMessage.notification?.body || '',
        android: {
          channelId: 'default',
          smallIcon: 'ic_notification',
        },
      });
    });

    return unsubscribe;
  }, []);

  return (
    <LoadingProvider>
         <AuthProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor={theme.colors.background} barStyle="dark-content" />
        {/* <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        /> */}
        <AppNavigator />
      </SafeAreaView>
      </AuthProvider>
    </LoadingProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
