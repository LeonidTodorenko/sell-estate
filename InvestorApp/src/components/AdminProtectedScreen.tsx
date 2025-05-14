import React, { useEffect, useState, ReactNode } from 'react';
import { View, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

interface Props {
  children: ReactNode;
}

const AdminProtectedScreen = ({ children }: Props) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        const user = stored ? JSON.parse(stored) : null;

        if (user?.role === 'admin') {
          setAuthorized(true);
        } else {
          Alert.alert('Access denied', 'Only admins can access this page.');
          navigation.goBack();
          setAuthorized(false);
        }
      } catch (err) {
        console.error('Access check failed', err);
        setAuthorized(false);
      }
    };

    checkAccess(); //todo add spinner while check
  }, []);

  if (authorized === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <>{authorized && children}</>;
};

export default AdminProtectedScreen;
