import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';

import StyledInput from '../components/StyledInput';
import BlueButton from '../components/BlueButton';
import { RootStackParamList } from '../navigation/AppNavigator';

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

const AddCardScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [saving, setSaving] = useState(false);

  const normalizedCardNumber = useMemo(
    () => cardNumber.replace(/\s/g, ''),
    [cardNumber],
  );

  const handleSave = async () => {
    const cleanNumber = normalizedCardNumber;
    const cleanExpiry = expiryDate.replace(/\D/g, '');
    const cleanCvv = cvv.replace(/\D/g, '');

    if (cleanNumber.length < 16) {
      Alert.alert('Validation', 'Enter a valid card number');
      return;
    }

    if (cleanExpiry.length !== 4) {
      Alert.alert('Validation', 'Enter expiry date in MM/YY format');
      return;
    }

    const month = parseInt(cleanExpiry.slice(0, 2), 10);
    if (month < 1 || month > 12) {
      Alert.alert('Validation', 'Enter a valid expiry month');
      return;
    }

    if (cleanCvv.length < 3) {
      Alert.alert('Validation', 'Enter a valid CVV');
      return;
    }

    if (!cardholderName.trim()) {
      Alert.alert('Validation', 'Enter name on card');
      return;
    }

    try {
      setSaving(true);

      // Пока фронтовая заглушка, без бэка
      setTimeout(() => {
        setSaving(false);
        Alert.alert('Success', 'Card saved successfully');
        navigation.goBack();
      }, 500);
    } catch (error) {
      setSaving(false);
      Alert.alert('Error', 'Failed to save card');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.headerShell}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={26} color="#171717" />
          </Pressable>

          <Text style={styles.headerTitle}>Add Card</Text>

          <View style={styles.headerRightPlaceholder} />
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardNumberWrap}>
          <StyledInput
            style={styles.bigInput}
            placeholder="Card Number"
            keyboardType="numeric"
            value={cardNumber}
            onChangeText={(text: string) => setCardNumber(formatCardNumber(text))}
          />

          <View style={styles.cardIconWrap}>
            <Ionicons name="card-outline" size={28} color="#3F3F46" />
          </View>
        </View>

        <View style={styles.row}>
          <StyledInput
            style={[styles.bigInput, styles.halfInput]}
            placeholder="Expiry Date"
            keyboardType="numeric"
            value={expiryDate}
            onChangeText={(text: string) => setExpiryDate(formatExpiry(text))}
          />

          <StyledInput
            style={[styles.bigInput, styles.halfInput]}
            placeholder="CVV"
            keyboardType="numeric"
            value={cvv}
            onChangeText={(text: string) => setCvv(text.replace(/\D/g, '').slice(0, 4))}
          />
        </View>

        <StyledInput
          style={styles.bigInput}
          placeholder="Name on Card"
          value={cardholderName}
          onChangeText={setCardholderName}
          autoCapitalize="words"
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <BlueButton
          title={saving ? 'Saving...' : 'Save Card'}
          onPress={handleSave}
          disabled={saving}
          width="full"
          showArrow={false}
          bgColor="#10B981"
          textColor="#FFFFFF"
          borderColor="#10B981"
          paddingVertical={14}
          style={styles.saveButton}
        />
      </View>
    </View>
  );
};

export default AddCardScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ECECEC',
  },

  headerShell: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingTop: 52,
    paddingBottom: 18,
    marginBottom: 18,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },

  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#171717',
  },

  headerRightPlaceholder: {
    width: 36,
  },

  container: {
    flex: 1,
    backgroundColor: '#ECECEC',
  },

  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },

  cardNumberWrap: {
    position: 'relative',
    marginBottom: 18,
  },

  cardIconWrap: {
    position: 'absolute',
    right: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  bigInput: {
    height: 68,
    borderRadius: 22,
    backgroundColor: '#F3F3F6',
    borderWidth: 0,
    paddingHorizontal: 18,
    fontSize: 18,
    color: '#171717',
  },

  halfInput: {
    width: '48.5%',
  },

  bottomSpacer: {
    height: 40,
  },

  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: 36,
    paddingTop: 8,
    backgroundColor: '#ECECEC',
  },

  saveButton: {
    borderRadius: 18,
    shadowOpacity: 0,
    elevation: 0,
    marginBottom: 0,
  },
});