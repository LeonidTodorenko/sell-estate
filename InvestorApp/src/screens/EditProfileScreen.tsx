import React, { useEffect, useState } from 'react';
import { View, Text,   StyleSheet, Alert, ScrollView, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { launchImageLibrary } from 'react-native-image-picker';
import { useLoading } from '../contexts/LoadingContext';
import StyledInput from '../components/StyledInput';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

//import { Buffer } from 'buffer';

global.Buffer = global.Buffer || require('buffer').Buffer;

const EditProfileScreen = () => {
    const { setLoading } = useLoading();
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [avatarBase64, setAvatarBase64] = useState('');

  useEffect(() => {
    
    const loadUser = async () => {
      setLoading(true);
      try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const response = await api.get(`/users/${parsed.userId}`);
      const data = response.data;
      setUser(data);
      setFullName(data.fullName);
      setEmail(data.email);
      setPhoneNumber(data.phoneNumber || '');
      setAddress(data.address || '');
      setAvatarBase64(data.avatarBase64 || '');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
    };
    loadUser();
  }, [setLoading]);

  const handleUpdate = async () => {
    if (!user) return;
    try {
      await api.post(`/users/${user.id}/update-profile`, {
        fullName,
        email,
        phoneNumber,
        address,
       // avatarBase64,
      });
      Alert.alert('Success', 'Profile updated');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handlePickAvatar = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
      includeBase64: true,
    });
  
    if (result.didCancel || !result.assets?.length) return;
  
    const asset = result.assets[0];
    const type = asset.type || 'image/jpeg';
  
    if (!asset.base64) {
      Alert.alert('Error', 'Failed to extract image data');
      return;
    }
  
    const base64Data = `data:${type};base64,${asset.base64}`;
    setAvatarBase64(base64Data);
  
    if (user) {
      try {
        await api.post(`/users/${user.id}/upload-avatar`, {
          base64Image: base64Data,
        });
        Alert.alert('Success', 'Avatar uploaded');
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to upload avatar');
      }
    }
  };
  
  

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>
      <Text>Joined: {user && new Date(user.createdAt).toLocaleDateString()}</Text>
      <View style={{ height: 20 }} />
      <Text>KYC Status: {user && user.kycStatus}</Text>
      <View style={{ height: 20 }} />
      <StyledInput style={styles.input} placeholder="Full Name" value={fullName} onChangeText={setFullName} />
      <StyledInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} />
      <StyledInput style={styles.input} placeholder="Phone Number" value={phoneNumber} onChangeText={setPhoneNumber} />
      <StyledInput style={styles.input} placeholder="Address" value={address} onChangeText={setAddress} />

      <Text style={{ marginTop: 10, fontWeight: 'bold' }}>Avatar:</Text>
       {avatarBase64 ? (
        <Image source={{ uri: avatarBase64 }} style={styles.avatar} />
      ) :  (
        <Text>No avatar</Text>
      )}
      <BlueButton title="📷 Upload  Avatar" onPress={handlePickAvatar} />

      <View style={{ height: 20 }} />
      <BlueButton title="Update" onPress={handleUpdate} />
      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20,backgroundColor: theme.colors.background },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', display: 'none'  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 12,
    borderRadius: 6,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#888'
  }
});

export default EditProfileScreen;
