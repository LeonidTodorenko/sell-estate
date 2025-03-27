import React, {  useState } from 'react';
import {  Text, TextInput, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'PropertyForm'>;

const PropertyFormScreen = ({ route, navigation }: Props) => {
  const existing = route.params?.property;

  const [title, setTitle] = useState(existing?.title || '');
  const [location, setLocation] = useState(existing?.location || '');
  const [price, setPrice] = useState(existing?.price?.toString() || '');
  const [totalShares, setTotalShares] = useState(existing?.totalShares?.toString() || '');
  const [upfrontPayment, setUpfrontPayment] = useState(existing?.upfrontPayment?.toString() || '');
  const [deadline, setDeadline] = useState(existing?.applicationDeadline?.split('T')[0] || '');

  const handleSubmit = async () => {
    if (!title || !location || !price || !totalShares) {
      Alert.alert('Validation', 'Please fill all required fields');
      return;
    }

    const payload = {
      title,
      location,
      price: parseFloat(price),
      totalShares: parseInt(totalShares),
      upfrontPayment: parseFloat(upfrontPayment) || 0,
      applicationDeadline: new Date(deadline).toISOString(),
    };

    try {
      if (existing?.id) {
        await api.put(`/properties/${existing.id}`, payload);
        Alert.alert('Success', 'Property updated');
        navigation.goBack();
      } else {
        await api.post('/properties', payload);
        Alert.alert('Success', 'Property created');
        navigation.goBack();
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save property');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{existing ? 'Edit' : 'Add'} Property</Text>

      <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
      <TextInput style={styles.input} placeholder="Location" value={location} onChangeText={setLocation} />
      <TextInput style={styles.input} placeholder="Price" keyboardType="numeric" value={price} onChangeText={setPrice} />
      <TextInput style={styles.input} placeholder="Total Shares" keyboardType="numeric" value={totalShares} onChangeText={setTotalShares} />
      <TextInput style={styles.input} placeholder="Upfront Payment" keyboardType="numeric" value={upfrontPayment} onChangeText={setUpfrontPayment} />
      <TextInput style={styles.input} placeholder="Application Deadline (YYYY-MM-DD)" value={deadline} onChangeText={setDeadline} />

      <Button title={existing ? 'Update' : 'Create'} onPress={handleSubmit} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 12,
    padding: 10,
    borderRadius: 6,
  },
});

export default PropertyFormScreen;
