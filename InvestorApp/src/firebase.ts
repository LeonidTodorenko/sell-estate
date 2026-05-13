// src/firebase.ts
import messaging from '@react-native-firebase/messaging';
import { Alert, Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function requestUserPermission() {
  const alreadyAsked = await AsyncStorage.getItem('askedPushPermission');
  if (alreadyAsked === 'true') return;

  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );

    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log('Android push permission granted');
      await AsyncStorage.setItem('askedPushPermission', 'true');
    } else {
      Alert.alert(
        'Permission denied',
        'Push notifications are not enabled.\n\nEnable notifications in Android settings.',
      );
    }

    return;
  }

  if (Platform.OS === 'ios') {
    const authStatus = await messaging().requestPermission();

    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      await messaging().registerDeviceForRemoteMessages();
      console.log('iOS push permission granted:', authStatus);
      await AsyncStorage.setItem('askedPushPermission', 'true');
    } else {
      Alert.alert('Permission denied', 'Push notifications are not enabled');
    }
  }
}

export async function getFcmToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') {
      const isRegistered = messaging().isDeviceRegisteredForRemoteMessages;

      if (!isRegistered) {
        await messaging().registerDeviceForRemoteMessages();
      }
    }

    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.warn('Error getting FCM token', error);
    return null;
  }
}