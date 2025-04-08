import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, TextInput, Image, Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../api';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';

type RouteProps = RouteProp<RootStackParamList, 'AdminKycUpload'>;

const AdminKycUploadScreen = () => {
  const { userId } = useRoute<RouteProps>().params;
  const [type, setType] = useState('passport');
  const [base64, setBase64] = useState<string | null>(null);

  const selectFile = () => {
    launchImageLibrary({ mediaType: 'photo', includeBase64: true }, (res) => {
      if (res.assets?.length) {
        setBase64(res.assets[0].base64 || null);
      }
    });
  };

  const upload = async () => {
    if (!base64) return Alert.alert('Error', 'Please select a file');

    try {
      await api.post('/kyc/upload', {
        userId,
        type,
        base64File: base64,
      });
      Alert.alert('Success', 'Document uploaded');
      setBase64(null);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Upload failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload KYC for User</Text>
      <Text>User ID: {userId}</Text>
      <TextInput value={type} onChangeText={setType} style={styles.input} placeholder="Type (e.g., passport)" />
      <Button title="Select File" onPress={selectFile} />
      {base64 && <Image source={{ uri: `data:image/jpeg;base64,${base64}` }} style={styles.preview} />}
      <Button title="Upload" onPress={upload} disabled={!base64} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginVertical: 10,
    borderRadius: 6,
  },
  preview: {
    width: 200,
    height: 150,
    resizeMode: 'contain',
    marginVertical: 10,
    alignSelf: 'center',
  },
});

export default AdminKycUploadScreen;
