import React, { useState } from 'react';
import { View,Modal,  Text, Button, ScrollView, StyleSheet, Alert } from 'react-native';
import StyledInput from '../components/StyledInput';
import api from '../api';

export interface NewPaymentPlan {
  milestone: string;
  dueDate: string;
  eventDate: string;
  installmentCode: string;
  percentage: number;
  amountDue: number;
  vat: number;
  paid: number;
}

interface AddPaymentPlanModalProps {
  visible: boolean;
  onClose: () => void;
  propertyId: string;
  onAdded: () => Promise<void>;
}

const AddPaymentPlanModal = ({ visible, onClose, propertyId, onAdded }: AddPaymentPlanModalProps) => {
  const [plan, setPlan] = useState<Partial<NewPaymentPlan>>({});

  const parseNumber = (text: string) => {
    const value = parseFloat(text);
    return isNaN(value) ? 0 : value;
  };

  const handleSave = async () => {
    if (!plan.milestone || !plan.dueDate || !plan.eventDate || !plan.installmentCode) {
      Alert.alert('Error', 'Please fill required fields.');
      return;
    }

    const planToSend = {
      ...plan,
      total: (plan.amountDue || 0) + (plan.vat || 0),
      dueDate: new Date(plan.dueDate).toISOString(),
      eventDate: new Date(plan.eventDate).toISOString(),
    };

    try {
      await api.post(`/properties/${propertyId}/payment-plans`, planToSend);
      Alert.alert('Success', 'Payment plan added.');
      await onAdded(); // reload plans
      setPlan({});
      onClose(); // close modal
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to add payment plan.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <ScrollView style={styles.modalContent}>
        <Text style={styles.title}>Add Payment Plan</Text>

        <StyledInput
          placeholder="Milestone"
          style={styles.input}
          value={plan.milestone}
          onChangeText={(text) => setPlan(p => ({ ...p, milestone: text }))}
        />

        <StyledInput
          placeholder="Event Date (YYYYMMDD)"
          style={styles.input}
          keyboardType="numeric"
          value={plan.eventDate}
          onChangeText={(text) => {
            const numbersOnly = text.replace(/\D/g, '');
            let formatted = numbersOnly;
            if (numbersOnly.length > 4) {
              formatted = numbersOnly.slice(0, 4) + '-' + numbersOnly.slice(4);
            }
            if (numbersOnly.length > 6) {
              formatted = numbersOnly.slice(0, 4) + '-' + numbersOnly.slice(4, 6) + '-' + numbersOnly.slice(6, 8);
            }
            setPlan(p => ({ ...p, eventDate: formatted }));
          }}
        />

        <StyledInput
          placeholder="Due Date (YYYYMMDD)"
          style={styles.input}
          keyboardType="numeric"
          value={plan.dueDate}
          onChangeText={(text) => {
            const numbersOnly = text.replace(/\D/g, '');
            let formatted = numbersOnly;
            if (numbersOnly.length > 4) {
              formatted = numbersOnly.slice(0, 4) + '-' + numbersOnly.slice(4);
            }
            if (numbersOnly.length > 6) {
              formatted = numbersOnly.slice(0, 4) + '-' + numbersOnly.slice(4, 6) + '-' + numbersOnly.slice(6, 8);
            }
            setPlan(p => ({ ...p, dueDate: formatted }));
          }}
        />

        <StyledInput
          placeholder="Installment Code"
          style={styles.input}
          value={plan.installmentCode}
          onChangeText={(text) => setPlan(p => ({ ...p, installmentCode: text }))}
        />

        <StyledInput placeholder="Percentage" style={styles.input} keyboardType="numeric" onChangeText={(text) => setPlan(p => ({ ...p, percentage: parseNumber(text) }))} />
        <StyledInput placeholder="Amount Due" style={styles.input} keyboardType="numeric" onChangeText={(text) => setPlan(p => ({ ...p, amountDue: parseNumber(text) }))} />
        <StyledInput placeholder="VAT" style={styles.input} keyboardType="numeric" onChangeText={(text) => setPlan(p => ({ ...p, vat: parseNumber(text) }))} />
        <StyledInput placeholder="Paid" style={styles.input} keyboardType="numeric" onChangeText={(text) => setPlan(p => ({ ...p, paid: parseNumber(text) }))} />

        <Button title="💾 Save" onPress={handleSave} />
          <View style={{ height: 10 }} />
        <Button title="Cancel" onPress={onClose} color="gray" />
      </ScrollView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContent: { padding: 20 },
  title: { fontSize: 20, marginBottom: 20, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
});

export default AddPaymentPlanModal;
