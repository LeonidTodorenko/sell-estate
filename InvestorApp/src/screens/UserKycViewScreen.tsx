import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, StyleSheet, Alert  } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../api';
import { RootStackParamList } from '../navigation/AppNavigator';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

interface KycDoc {
  id: string;
  type: string;
  base64File: string;
  status: string;
  uploadedAt: string;
}

type RouteProps = RouteProp<RootStackParamList, 'UserKycView'>;

const UserKycViewScreen = () => {
  const route = useRoute<RouteProps>();
  const { userId } = route.params;
  const [docs, setDocs] = useState<KycDoc[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/kyc/user/${userId}`);
      setDocs(res.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load documents');
    }
  }, [userId]);

  const uploadForUser = async () => {
    launchImageLibrary({ mediaType: 'photo', includeBase64: true }, async (res) => {
      if (res.assets && res.assets.length > 0) {
        const base64 = res.assets[0].base64;
        if (!base64) return;

        try {
          await api.post('/kyc/admin-upload', {
            userId,
            type: 'passport', // или сделать выбор типа
            base64File: base64,
          });

          Alert.alert('Success', 'Document uploaded');
          load();
        } catch (err) {
          Alert.alert('Error', 'Failed to upload');
        }
      }
    });
  };

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User's KYC Documents</Text>

      <BlueButton title="➕ Upload New Document" onPress={uploadForUser} />

      <FlatList
        data={docs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>Type: {item.type}</Text>
            <Text>Status: {item.status}</Text>
            <Text>Date: {new Date(item.uploadedAt).toLocaleDateString()}</Text>
            <Image
              source={{ uri: `data:image/jpeg;base64,${item.base64File}` }}
              style={styles.image}
            />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 ,backgroundColor: theme.colors.background},
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 12,
    borderRadius: 6,
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    marginTop: 10,
  },
});

export default UserKycViewScreen;
