import React, { useState } from 'react';
import { Text,   StyleSheet, ScrollView, Alert, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../api';
import StyledInput from '../components/StyledInput';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TouchableOpacity } from 'react-native';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PropertyForm'>;

const PropertyFormScreen = ({ route, navigation }: Props) => {
  const existing = route.params?.property;

  const [title, setTitle] = useState(existing?.title || '');
  const [location, setLocation] = useState(existing?.location || '');
  const [price, setPrice] = useState(existing?.price?.toString() || '');
  const [totalShares, setTotalShares] = useState(existing?.totalShares?.toString() || '');
  const [availableShares, setAvailableShares] = useState(existing?.availableShares?.toString() || '');
  const [upfrontPayment, setUpfrontPayment] = useState(existing?.upfrontPayment?.toString() || '');
  
  const [monthlyRentalIncome, setMonthlyRentalIncome] = useState(existing?.monthlyRentalIncome?.toString() || '');
 
  const [realPrice, setRealPrice] = useState(existing?.realPrice?.toString() || '');

  const [listingType, setListingType] = useState(existing?.listingType || 'sale');
  const [buybackPricePerShare, setBuybackPricePerShare] = useState(existing?.buybackPricePerShare?.toString() || '');
  const [latitude, setLatitude] = useState(existing?.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(existing?.longitude?.toString() || '');
   const [videoUrl, setVideoUrl] = useState(existing?.videoUrl || '');

  //const [deadline, setDeadline] = useState(existing?.applicationDeadline?.split('T')[0] || '');
  const [deadline, setDeadline] = useState<Date>(existing?.applicationDeadline ? new Date(existing.applicationDeadline) : new Date());
  //const [lastPayoutDate, setLastPayoutDate] = useState(existing?.lastPayoutDate?.split('T')[0] || '');
  const [lastPayoutDate, setLastPayoutDate] = useState<Date>(existing?.lastPayoutDate ? new Date(existing.lastPayoutDate) : new Date());
  //const [completionDate, setCompletionDate] = useState(    existing?.expectedCompletionDate?.split('T')[0] || ''  );
  const [completionDate, setCompletionDate] = useState<Date>(existing?.expectedCompletionDate ? new Date(existing.expectedCompletionDate) : new Date());

  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [showCompletionDatePicker, setShowCompletionDatePicker] = useState(false);
  const [showLastPayoutDatePicker, setShowLastPayoutDatePicker] = useState(false);
  

  const initializeForm = useCallback(() => {
    const existing = route.params?.property;

    setTitle(existing?.title || '');
    setLocation(existing?.location || '');
    setPrice(existing?.price?.toString() || '');
    setTotalShares(existing?.totalShares?.toString() || '');
    setAvailableShares(existing?.availableShares?.toString() || '');
    setUpfrontPayment(existing?.upfrontPayment?.toString() || '');
    setDeadline(existing?.applicationDeadline ? new Date(existing.applicationDeadline) : new Date());
    //setDeadline(existing?.applicationDeadline?.split('T')[0] || '');
    setCompletionDate(existing?.expectedCompletionDate ? new Date(existing.expectedCompletionDate) : new Date());
    //setCompletionDate(existing?.expectedCompletionDate?.split('T')[0] || '');
    setLastPayoutDate(existing?.lastPayoutDate ? new Date(existing.lastPayoutDate) : new Date());
    //setLastPayoutDate(existing?.lastPayoutDate?.split('T')[0] || '');
    setMonthlyRentalIncome(existing?.monthlyRentalIncome?.toString() || '');
    setRealPrice(existing?.realPrice?.toString() || '');
    setListingType(existing?.listingType || 'sale');
    setBuybackPricePerShare(existing?.buybackPricePerShare?.toString() || '');
    setLatitude(existing?.latitude?.toString() || '');
    setLongitude(existing?.longitude?.toString() || '');
     setVideoUrl(existing?.videoUrl || '');
  }, [route.params]);

  useFocusEffect(initializeForm);

  const handleSubmit = async () => {
    if (!title || !location || !price ) {
      Alert.alert('Validation', 'Please fill all required fields');
      return;
    }

       if (videoUrl && !videoUrl.startsWith('http')) {
      Alert.alert('Validation', 'Video URL must start with http/https');
      return;
    }


    let  payload: any = {
      title,
      location,
      price: parseFloat(price),
      //totalShares: totalShares != null ? parseInt(totalShares, 10) : 0,
      //availableShares: availableShares != null ? parseInt(availableShares, 10) : 0,
      upfrontPayment: upfrontPayment != null ?  parseFloat(upfrontPayment) || 0  : 0,
      applicationDeadline: deadline.toISOString(),//new Date(deadline).toISOString(),
      listingType,
      buybackPricePerShare: parseFloat(buybackPricePerShare),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      expectedCompletionDate: completionDate.toISOString(),//new Date(completionDate).toISOString(),
      monthlyRentalIncome: parseFloat(monthlyRentalIncome) || 0,
      lastPayoutDate: lastPayoutDate.toISOString(),//new Date(lastPayoutDate).toISOString(),
      //realPrice: parseFloat(realPrice) || parseFloat(price),
        videoUrl: videoUrl.trim() || null,
    };

    if (existing?.id) {
      payload.totalShares = parseInt(totalShares, 10);
      payload.availableShares = parseInt(availableShares, 10);
      payload.realPrice = parseFloat(realPrice) || parseFloat(price);
    }

    try {
       const res = existing?.id
        ? await api.put(`/properties/${existing.id}`, payload )
        : await api.post('/properties', payload );

      if (res.status === 202) {
        Alert.alert('Sent to moderation', 'Price change needs approval.');
        navigation.goBack();
        return;
      }
      if (res.status >= 200 && res.status < 300) {
        Alert.alert('Success', existing?.id ? 'Property updated' : 'Property created');
        navigation.goBack();
      } else {
        const msg = res.data?.message ?? 'Failed to save';
        Alert.alert('Error', msg);
      }
    }    
     catch (error: any) {
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
      {/* <Text>Application Deadline</Text>
      <StyledInput style={styles.input} placeholder="Application Deadline (YYYY-MM-DD)" value={deadline} onChangeText={setDeadline} /> */}
      <Text>Application Deadline</Text>
      <TouchableOpacity onPress={() => setShowDeadlinePicker(true)}>
        <StyledInput
          style={styles.input}
          value={deadline.toDateString()}
          editable={false}
          pointerEvents="none"
        />
      </TouchableOpacity>

      {showDeadlinePicker && (
        <DateTimePicker
          value={deadline}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDeadlinePicker(false);
            if (selectedDate) setDeadline(selectedDate);
          }}
        />
      )}

      <Text>Listing Type:</Text>
      <BlueButton
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
      <TouchableOpacity onPress={() => setShowCompletionDatePicker(true)}>
        <StyledInput
          style={styles.input}
          value={completionDate.toDateString()}
          editable={false}
          pointerEvents="none"
        />
      </TouchableOpacity>

      {showCompletionDatePicker && (
        <DateTimePicker
          value={completionDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowCompletionDatePicker(false);
            if (selectedDate) setCompletionDate(selectedDate);
          }}
        />
      )}
      
      {/* <StyledInput style={styles.input} placeholder="Expected Completion Date (YYYY-MM-DD)" value={completionDate} onChangeText={setCompletionDate} /> */}
      
      <Text>Monthly Rental Income</Text>
      <StyledInput style={styles.input} placeholder="Monthly Rental Income" keyboardType="numeric" value={monthlyRentalIncome} onChangeText={setMonthlyRentalIncome} />
       
       <Text>Last Payout Date </Text>
       <TouchableOpacity onPress={() => setShowLastPayoutDatePicker(true)}>
        <StyledInput
          style={styles.input}
          value={lastPayoutDate.toDateString()}
          editable={false}
          pointerEvents="none"
        />
      </TouchableOpacity>

      {showLastPayoutDatePicker && (
        <DateTimePicker
          value={lastPayoutDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowLastPayoutDatePicker(false);
            if (selectedDate) setLastPayoutDate(selectedDate);
          }}
        />
      )}
      {/* <StyledInput style={styles.input} placeholder="Last Payout Date (YYYY-MM-DD)" value={lastPayoutDate} onChangeText={setLastPayoutDate} /> */}

           <Text>Video URL (YouTube)</Text>
        <StyledInput
          style={styles.input}
          placeholder="https://www.youtube.com/watch?v=..."
          value={videoUrl}
          onChangeText={setVideoUrl}
          autoCapitalize="none"
        />

      <BlueButton   title={existing ? 'Update' : 'Create'} onPress={handleSubmit} />
       <View style={{ height: 50 }} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16,backgroundColor: theme.colors.background },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', display: 'none'  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 12,
    padding: 10,
    borderRadius: 6,
  },
});

export default PropertyFormScreen;
