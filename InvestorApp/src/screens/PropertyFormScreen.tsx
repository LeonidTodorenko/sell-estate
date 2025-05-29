import React, { useState } from 'react';
import { Text, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';
import StyledInput from '../components/StyledInput';

type Props = NativeStackScreenProps<RootStackParamList, 'PropertyForm'>;

const PropertyFormScreen = ({ route, navigation }: Props) => {
  const existing = route.params?.property;

  const [title, setTitle] = useState(existing?.title || '');
  const [location, setLocation] = useState(existing?.location || '');
  const [price, setPrice] = useState(existing?.price?.toString() || '');
  const [totalShares, setTotalShares] = useState(existing?.totalShares?.toString() || '');
  const [availableShares, setAvailableShares] = useState(existing?.availableShares?.toString() || '');
  const [upfrontPayment, setUpfrontPayment] = useState(existing?.upfrontPayment?.toString() || '');
  const [deadline, setDeadline] = useState(existing?.applicationDeadline?.split('T')[0] || '');
  const [monthlyRentalIncome, setMonthlyRentalIncome] = useState(existing?.monthlyRentalIncome?.toString() || '');
  const [lastPayoutDate, setLastPayoutDate] = useState(existing?.lastPayoutDate?.split('T')[0] || '');

  const [listingType, setListingType] = useState(existing?.listingType || 'sale');
  const [buybackPricePerShare, setBuybackPricePerShare] = useState(existing?.buybackPricePerShare?.toString() || '');
  const [latitude, setLatitude] = useState(existing?.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(existing?.longitude?.toString() || '');

  const [completionDate, setCompletionDate] = useState(
    existing?.expectedCompletionDate?.split('T')[0] || ''
  );

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
      availableShares: parseInt(availableShares),
      upfrontPayment: parseFloat(upfrontPayment) || 0,
      applicationDeadline: new Date(deadline).toISOString(),
      listingType,
      buybackPricePerShare: parseFloat(buybackPricePerShare),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      expectedCompletionDate: new Date(completionDate).toISOString(),
      monthlyRentalIncome: parseFloat(monthlyRentalIncome) || 0,
      lastPayoutDate: new Date(lastPayoutDate).toISOString(),
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
    }     catch (error: any) {
          let message = 'Failed to save property ';
          console.error(error);
          if (error.response && error.response.data) {
            message = JSON.stringify(error.response.data);
          } else if (error.message) {
            message = error.message;
          }
          Alert.alert('Error', 'Failed to save property ' + message);
        }
  };

  return (
    <KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
> 
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>{existing ? 'Edit' : 'Add'} Property</Text>

      <StyledInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
      <StyledInput style={styles.input} placeholder="Location" value={location} onChangeText={setLocation} />
      <StyledInput style={styles.input} placeholder="Price" keyboardType="numeric" value={price} onChangeText={setPrice} />
      <StyledInput style={styles.input} placeholder="Total Shares" keyboardType="numeric" value={totalShares} onChangeText={setTotalShares} />
      <StyledInput style={styles.input} placeholder="Available Shares" keyboardType="numeric" value={availableShares} onChangeText={setAvailableShares} />
      <StyledInput style={styles.input} placeholder="Upfront Payment" keyboardType="numeric" value={upfrontPayment} onChangeText={setUpfrontPayment} />
      <StyledInput style={styles.input} placeholder="Application Deadline (YYYY-MM-DD)" value={deadline} onChangeText={setDeadline} />
      <Text>Listing Type:</Text>
      <Button
        title={listingType === 'sale' ? 'For Sale (Tap to switch)' : 'For Rent (Tap to switch)'}
        onPress={() => setListingType(listingType === 'sale' ? 'rent' : 'sale')}
      />
      <StyledInput style={styles.input} placeholder="BuybackPricePerShare" keyboardType="numeric" value={buybackPricePerShare} onChangeText={setBuybackPricePerShare} />
      <StyledInput style={styles.input} placeholder="Latitude" keyboardType="numeric" value={latitude} onChangeText={setLatitude} />
      <StyledInput style={styles.input} placeholder="Longitude" keyboardType="numeric" value={longitude} onChangeText={setLongitude} />
      <StyledInput style={styles.input} placeholder="Expected Completion Date (YYYY-MM-DD)" value={completionDate} onChangeText={setCompletionDate} />

      <StyledInput style={styles.input} placeholder="Monthly Rental Income" keyboardType="numeric" value={monthlyRentalIncome} onChangeText={setMonthlyRentalIncome} />
      <StyledInput style={styles.input} placeholder="Last Payout Date (YYYY-MM-DD)" value={lastPayoutDate} onChangeText={setLastPayoutDate} />

      <Button title={existing ? 'Update' : 'Create'} onPress={handleSubmit} />
    </ScrollView>
    </KeyboardAvoidingView>
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
