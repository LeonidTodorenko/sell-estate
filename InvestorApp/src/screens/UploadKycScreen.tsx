import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Image, Alert, TextInput } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

const UploadKycScreen = () => {
  const [base64, setBase64] = useState<string | null>(null);
  const [type, setType] = useState<string>('passport');

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
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to upload');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload KYC Document</Text>
      <Text>Type:</Text>
      <TextInput value={type} onChangeText={setType} style={styles.input} />
      <Button title="Select File" onPress={selectFile} />
      {base64 && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${base64}` }}
          style={styles.preview}
        />
      )}
      <Button title="Upload" onPress={upload} disabled={!base64} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
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
});

export default UploadKycScreen;
