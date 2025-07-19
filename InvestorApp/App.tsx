import React, { useEffect } from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { Alert, SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import theme from './src/constants/theme';
import { LoadingProvider } from './src/contexts/LoadingContext';
import { requestUserPermission, getFcmToken } from './src/firebase';
import messaging from '@react-native-firebase/messaging';

//export default function App(): React.JSX.Element {
//  return <AppNavigator />;
//}

export default function App() {
    useEffect(() => {
    requestUserPermission();
    getFcmToken();

    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('Push received in foreground:', remoteMessage);
      Alert.alert(`New notification: ${remoteMessage.notification?.title}`);
    });

    return unsubscribe;
  }, []);

  return (
    <LoadingProvider>
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={theme.colors.background} barStyle="dark-content" />
      <AppNavigator />
    </SafeAreaView>
    </LoadingProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
 