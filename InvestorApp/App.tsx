import React, { useCallback, useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import messaging from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
} from '@notifee/react-native';

import AppNavigator from './src/navigation/AppNavigator';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import NetworkStatusBanner from './src/components/NetworkStatusBanner';
import theme from './src/constants/theme';
import { LoadingProvider } from './src/contexts/LoadingContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { NetworkProvider } from './src/contexts/NetworkContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      networkMode: 'online',
    },

    mutations: {
      networkMode: 'online',
      retry: 0,
    },
  },
});

export default function App() {
  const [appKey, setAppKey] = useState(0);

  const restartAppTree = useCallback(() => {
    queryClient.clear();
    setAppKey(value => value + 1);
  }, []);

  useEffect(() => {
    const setup = async () => {
      try {
        // TODO: Firebase временно отключён:
        // await requestUserPermission();
        // await getFcmToken();

        await notifee.createChannel({
          id: 'default',
          name: 'Default Channel',
          importance: AndroidImportance.HIGH,
        });
      } catch (error) {
        console.error(
          '[App] Notification setup failed:',
          error,
        );
      }
    };

    void setup();

    const unsubscribe = messaging().onMessage(
      async remoteMessage => {
        try {
          console.log(
            'Push received in foreground:',
            remoteMessage,
          );

          await notifee.displayNotification({
            title:
              remoteMessage.notification?.title ||
              'New Notification',
            body:
              remoteMessage.notification?.body || '',
            android: {
              channelId: 'default',
              smallIcon: 'ic_notification',
            },
          });
        } catch (error) {
          console.error(
            '[App] Failed to display notification:',
            error,
          );
        }
      },
    );

    return unsubscribe;
  }, []);

  return (
    <AppErrorBoundary
      key={appKey}
      onRestart={restartAppTree}
    >
      <QueryClientProvider client={queryClient}>
        <NetworkProvider>
          <LoadingProvider>
            <AuthProvider>
              <View style={styles.root}>
                <SafeAreaView style={styles.container}>
                  <StatusBar
                    backgroundColor={theme.colors.background}
                    barStyle="dark-content"
                  />

                  <AppNavigator />
                </SafeAreaView>

                <NetworkStatusBanner />
              </View>
            </AuthProvider>
          </LoadingProvider>
        </NetworkProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});