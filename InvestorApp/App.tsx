import React, { useEffect } from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import theme from './src/constants/theme';
import { LoadingProvider } from './src/contexts/LoadingContext';
import { requestUserPermission, getFcmToken } from './src/firebase';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { AuthProvider } from './src/contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { navigationRef } from './src/navigation/navigationRef';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
  },
});

const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.background,
  },
};

const linking = {
  prefixes: ['sellestate://'],
  config: {
    screens: {
      ResetNotLoggedPassword: {
        path: 'reset-password',
        parse: {
          token: (token: string) => token,
        },
      },
    },
  },
};

export default function App() {
  useEffect(() => {
    const setup = async () => {
      await requestUserPermission();
      await getFcmToken();

      await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
      });
    };

    setup();

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
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>
        <AuthProvider>

          {/* 👇 ВАЖНО: NavigationContainer ЗДЕСЬ */}
          <NavigationContainer
            ref={navigationRef}
            linking={linking}
            theme={MyTheme}
          >
            <SafeAreaView style={styles.container}>
              <StatusBar
                backgroundColor={theme.colors.background}
                barStyle="dark-content"
              />
              <AppNavigator />
            </SafeAreaView>
          </NavigationContainer>

        </AuthProvider>
      </LoadingProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});