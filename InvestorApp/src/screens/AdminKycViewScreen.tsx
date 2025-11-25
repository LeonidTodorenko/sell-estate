// Updated UploadKycScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text,   StyleSheet, Image, Alert, TextInput, FlatList } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

interface KycDoc {
  id: string;
  type: string;
  base64File: string;
  status: string;
  uploadedAt: string;
}

const AdminKycViewScreen = () => {
  const [base64, setBase64] = useState<string | null>(null);
  const [type, setType] = useState<string>('passport');
  const [docs, setDocs] = useState<KycDoc[]>([]);

  const selectFile = () => {
    launchImageLibrary({ mediaType: 'photo', includeBase64: true }, (res) => {
      if (res.assets && res.assets.length > 0) {
        setBase64(res.assets[0].base64 || null);
      }
    });
  };

  const upload = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored || !base64) return Alert.alert('Error', 'Missing data');

      const user = JSON.parse(stored);

      await api.post('/kyc/upload', {
        userId: user.userId,
        type,
        base64File: base64,
      });

      Alert.alert('Success', 'Document uploaded');
      setBase64(null);
      fetchDocs();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to upload');
    }
  };

  const fetchDocs = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;

      const user = JSON.parse(stored);
      const res = await api.get(`/kyc/user/${user.userId}`);
      setDocs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload KYC Document</Text>

      <Text>Type:</Text>
      <TextInput value={type} onChangeText={setType} style={styles.input} />

      <BlueButton title="Select File" onPress={selectFile} />
      {base64 && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${base64}` }}
          style={styles.preview}
        />
      )}
      <BlueButton title="Upload" onPress={upload} disabled={!base64} />

      <Text style={styles.subheading}>My Documents:</Text>
      <FlatList
        data={docs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>Type: {item.type}</Text>
            <Text>Status: {item.status}</Text>
            <Text>Uploaded: {new Date(item.uploadedAt).toLocaleDateString()}</Text>
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
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginBottom: 10,
    borderRadius: 6,
  },
  preview: {
    width: 200,
    height: 150,
    resizeMode: 'contain',
    marginVertical: 10,
    alignSelf: 'center',
  },
  subheading: { fontSize: 18, fontWeight: '600', marginTop: 20 },
  card: {
    marginVertical: 10,
    padding: 10,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
  },
  image: {
    width: '100%',
    height: 120,
    resizeMode: 'contain',
    marginTop: 8,
  },
});

export default AdminKycViewScreen;
