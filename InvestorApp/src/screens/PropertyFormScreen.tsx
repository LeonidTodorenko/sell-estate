import React, { useState } from 'react';
import { Text, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';
import StyledInput from '../components/StyledInput';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

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
  const [realPrice, setRealPrice] = useState(existing?.realPrice?.toString() || '');

  const [listingType, setListingType] = useState(existing?.listingType || 'sale');
  const [buybackPricePerShare, setBuybackPricePerShare] = useState(existing?.buybackPricePerShare?.toString() || '');
  const [latitude, setLatitude] = useState(existing?.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(existing?.longitude?.toString() || '');

  const [completionDate, setCompletionDate] = useState(
    existing?.expectedCompletionDate?.split('T')[0] || ''
  );

  const initializeForm = useCallback(() => {
    const existing = route.params?.property;

    setTitle(existing?.title || '');
    setLocation(existing?.location || '');
    setPrice(existing?.price?.toString() || '');
    setTotalShares(existing?.totalShares?.toString() || '');
    setAvailableShares(existing?.availableShares?.toString() || '');
    setUpfrontPayment(existing?.upfrontPayment?.toString() || '');
    setDeadline(existing?.applicationDeadline?.split('T')[0] || '');
    setMonthlyRentalIncome(existing?.monthlyRentalIncome?.toString() || '');
    setLastPayoutDate(existing?.lastPayoutDate?.split('T')[0] || '');
    setRealPrice(existing?.realPrice?.toString() || '');
    setListingType(existing?.listingType || 'sale');
    setBuybackPricePerShare(existing?.buybackPricePerShare?.toString() || '');
    setLatitude(existing?.latitude?.toString() || '');
    setLongitude(existing?.longitude?.toString() || '');
    setCompletionDate(existing?.expectedCompletionDate?.split('T')[0] || '');
  }, [route.params]);

  useFocusEffect(initializeForm);

  const handleSubmit = async () => {
    if (!title || !location || !price ) {
      Alert.alert('Validation', 'Please fill all required fields');
      return;
    }

    let  payload: any = {
      title,
      location,
      price: parseFloat(price),
      //totalShares: totalShares != null ? parseInt(totalShares, 10) : 0,
      //availableShares: availableShares != null ? parseInt(availableShares, 10) : 0,
      upfrontPayment: upfrontPayment != null ?  parseFloat(upfrontPayment) || 0  : 0,
      applicationDeadline: new Date(deadline).toISOString(),
      listingType,
      buybackPricePerShare: parseFloat(buybackPricePerShare),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      expectedCompletionDate: new Date(completionDate).toISOString(),
      monthlyRentalIncome: parseFloat(monthlyRentalIncome) || 0,
      lastPayoutDate: new Date(lastPayoutDate).toISOString(),
      //realPrice: parseFloat(realPrice) || parseFloat(price),
    };

    if (existing?.id) {
      payload.totalShares = parseInt(totalShares, 10);
      payload.availableShares = parseInt(availableShares, 10);
      payload.realPrice = parseFloat(realPrice) || parseFloat(price);
    }

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
      
      <Text>Title</Text>
      <StyledInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
       <Text>Location</Text>
      <StyledInput style={styles.input} placeholder="Location" value={location} onChangeText={setLocation} />
      <Text>Price</Text>
      <StyledInput style={styles.input} placeholder="Price" keyboardType="numeric" value={price}  onChangeText={setPrice}       />
      {existing && (
        <Text>Total Shares</Text>
      )}
      {existing && (
        <StyledInput style={styles.input} placeholder="Total Shares" keyboardType="numeric" value={totalShares} onChangeText={setTotalShares} />
      )}
       {existing && (
        <Text>Available Shares</Text>
      )}
      {existing && (
       <StyledInput style={styles.input} placeholder="Available Shares" keyboardType="numeric" value={availableShares} onChangeText={setAvailableShares} />
      )}
      {existing && (
        <Text>Real Price</Text>
      )}
      {existing && (
        <StyledInput
        style={styles.input}
        placeholder="Real Price"
        keyboardType="numeric"
        value={realPrice}
        onChangeText={setRealPrice}
      />
      )}
      <Text>Upfront Payment</Text>
      <StyledInput style={styles.input} placeholder="Upfront Payment" keyboardType="numeric" value={upfrontPayment} onChangeText={setUpfrontPayment} />
      <Text>Application Deadline</Text>
      <StyledInput style={styles.input} placeholder="Application Deadline (YYYY-MM-DD)" value={deadline} onChangeText={setDeadline} />
      <Text>Listing Type:</Text>
      <Button
        title={listingType === 'sale' ? 'For Sale (Tap to switch)' : 'For Rent (Tap to switch)'}
        onPress={() => setListingType(listingType === 'sale' ? 'rent' : 'sale')}
      />
      <Text>Buyback price per share</Text>
      <StyledInput style={styles.input} placeholder="BuybackPricePerShare" keyboardType="numeric" value={buybackPricePerShare} onChangeText={setBuybackPricePerShare} />
      <Text>Latitude</Text>
      <StyledInput style={styles.input} placeholder="Latitude" keyboardType="numeric" value={latitude} onChangeText={setLatitude} />
       <Text>Longitude</Text>
      <StyledInput style={styles.input} placeholder="Longitude" keyboardType="numeric" value={longitude} onChangeText={setLongitude} />
       <Text>Expected Completion Date</Text>
      <StyledInput style={styles.input} placeholder="Expected Completion Date (YYYY-MM-DD)" value={completionDate} onChangeText={setCompletionDate} />
      <Text>Monthly Rental Income</Text>
      <StyledInput style={styles.input} placeholder="Monthly Rental Income" keyboardType="numeric" value={monthlyRentalIncome} onChangeText={setMonthlyRentalIncome} />
       <Text>Last Payout Date </Text>
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
