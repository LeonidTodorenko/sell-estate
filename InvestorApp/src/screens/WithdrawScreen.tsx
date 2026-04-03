import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import StyledInput from '../components/StyledInput';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';
import Ionicons from 'react-native-vector-icons/Ionicons';

type CardItem = {
  id: string;
  brand: string;
  last4: string;
};

const DUMMY_AVAILABLE_AMOUNT = 15800;
const WITHDRAW_FEE_PERCENT = 1.5;

const DUMMY_CARDS: CardItem[] = [
  { id: '1', brand: 'Visa', last4: '4242' },
  { id: '2', brand: 'Mastercard', last4: '8888' },
];

function formatMoney(value: number) {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const PaymentMethodRow = ({
  item,
  selected,
  onPress,
}: {
  item: CardItem;
  selected: boolean;
  onPress: () => void;
}) => {
  return (
    <Pressable onPress={onPress} style={styles.cardRow}>
      <View style={styles.cardRowLeft}>
        <View style={styles.cardIconCircle}>
          <Ionicons name="card-outline" size={20} color="#4B5563" />
        </View>

        <Text style={styles.cardRowTitle}>
          {item.brand} ·· {item.last4}
        </Text>
      </View>

      <View
        style={[
          styles.radioOuter,
          selected && styles.radioOuterSelected,
        ]}
      >
        {selected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
      </View>
    </Pressable>
  );
};

const WithdrawScreen = () => {
  const [amount, setAmount] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string>(DUMMY_CARDS[0].id);
  const [submitting, setSubmitting] = useState(false);

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const parsedAmount = useMemo(() => {
    const normalized = amount.replace(',', '.').trim();
    const num = parseFloat(normalized);
    return Number.isFinite(num) ? num : 0;
  }, [amount]);

  const feeAmount = useMemo(() => {
    if (parsedAmount <= 0) return 0;
    return (parsedAmount * WITHDRAW_FEE_PERCENT) / 100;
  }, [parsedAmount]);

  const receiveAmount = useMemo(() => {
    if (parsedAmount <= 0) return 0;
    return Math.max(0, parsedAmount - feeAmount);
  }, [parsedAmount, feeAmount]);

  const handleAddCard = () => {
    navigation.navigate('AddCard');
  };

  const handleWithdraw = async () => {
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Validation', 'Enter withdrawal amount');
      return;
    }

    if (parsedAmount > DUMMY_AVAILABLE_AMOUNT) {
      Alert.alert('Validation', 'Amount exceeds available balance');
      return;
    }

    if (!selectedCardId) {
      Alert.alert('Validation', 'Select payment method');
      return;
    }

    try {
      setSubmitting(true);

      const stored = await AsyncStorage.getItem('user');
      if (!stored) {
        Alert.alert('Session error', 'User not found');
        return;
      }

      const user = JSON.parse(stored);

      await api.post('/withdrawals/request', {
        userId: user.userId,
        amount: parsedAmount,
      });

      Alert.alert('Success', 'Withdrawal request submitted');
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to submit withdrawal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.headerShell}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={26} color="#171717" />
          </Pressable>

          <Text style={styles.headerTitle}>Withdraw Funds</Text>

          <View style={styles.headerRightPlaceholder} />
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.amountInputWrap}>
          <StyledInput
            style={styles.amountInput}
            placeholder="Withdrawal amount"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />

          <View style={styles.amountIconWrap}>
            <Ionicons name="cash-outline" size={28} color="#3F3F46" />
          </View>
        </View>

        <Text style={styles.availableText}>
          Available for withdrawal: {formatMoney(DUMMY_AVAILABLE_AMOUNT)}
        </Text>

        <Text style={styles.sectionTitle}>Payment Method</Text>

        <View style={styles.methodsCard}>
          {DUMMY_CARDS.map((card, index) => (
            <View key={card.id}>
              <PaymentMethodRow
                item={card}
                selected={selectedCardId === card.id}
                onPress={() => setSelectedCardId(card.id)}
              />

              {index !== DUMMY_CARDS.length - 1 && <View style={styles.methodDivider} />}
            </View>
          ))}

          <Pressable onPress={handleAddCard} style={styles.addCardRow}>
            <Ionicons name="add" size={34} color="#10B981" />
            <Text style={styles.addCardText}>Add Card</Text>
          </Pressable>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryRowTop}>
          <Text style={styles.summaryMuted}>You'll receive:</Text>
          <Text style={styles.summaryMuted}>Fee:</Text>
        </View>

        <View style={styles.summaryRowBottom}>
          <Text style={styles.summaryAmount}>{formatMoney(receiveAmount)}</Text>
          <Text style={styles.summaryAmount}>
            {formatMoney(feeAmount)}{' '}
            <Text style={styles.summaryFeePercent}>({WITHDRAW_FEE_PERCENT}%)</Text>
          </Text>
        </View>

        <Text style={styles.arrivalText}>Funds will arrive in 1-3 business days</Text>

        <BlueButton
          title={submitting ? 'Please wait...' : 'Withdraw'}
          onPress={handleWithdraw}
          disabled={submitting}
          width="full"
          showArrow={false}
          bgColor="#10B981"
          textColor="#FFFFFF"
          borderColor="#10B981"
          paddingVertical={14}
          style={styles.withdrawButton}
        />
      </ScrollView>
    </View>
  );
};

export default WithdrawScreen;

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
    paddingBottom: 110,
  },

  amountInputWrap: {
    position: 'relative',
    marginBottom: 10,
  },

  amountInput: {
    height: 68,
    borderRadius: 22,
    backgroundColor: '#F3F3F6',
    borderWidth: 0,
    paddingLeft: 18,
    paddingRight: 64,
    fontSize: 18,
    color: '#171717',
  },

  amountIconWrap: {
    position: 'absolute',
    right: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },

  availableText: {
    fontSize: 16,
    color: '#A1A1AA',
    marginBottom: 30,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#171717',
    marginBottom: 18,
  },

  methodsCard: {
    backgroundColor: 'transparent',
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },

  cardRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },

  cardIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E8E8EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },

  cardRowTitle: {
    fontSize: 19,
    fontWeight: '500',
    color: '#171717',
  },

  radioOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#D4D4D8',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },

  radioOuterSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },

  methodDivider: {
    height: 1,
    backgroundColor: '#DDE2E7',
    marginLeft: 68,
  },

  addCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 8,
  },

  addCardText: {
    marginLeft: 12,
    fontSize: 20,
    fontWeight: '500',
    color: '#10B981',
  },

  summaryDivider: {
    height: 1,
    backgroundColor: '#DDE2E7',
    marginTop: 34,
    marginBottom: 18,
  },

  summaryRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  summaryMuted: {
    fontSize: 16,
    color: '#A1A1AA',
    fontWeight: '500',
  },

  summaryRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },

  summaryAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#171717',
  },

  summaryFeePercent: {
    color: '#A1A1AA',
    fontSize: 16,
    fontWeight: '500',
  },

  arrivalText: {
    marginTop: 28,
    fontSize: 16,
    color: '#A1A1AA',
  },

  withdrawButton: {
    marginTop: 34,
    borderRadius: 18,
    shadowOpacity: 0,
    elevation: 0,
    marginBottom: 0,
  },
});