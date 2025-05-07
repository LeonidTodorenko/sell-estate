import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Button, Alert, ScrollView, FlatList, TextInput, Modal } from 'react-native';
import api from '../api';
import StyledInput from '../components/StyledInput';

interface PaymentPlan {
  id: string;
  milestone: string;
  eventDate?: string;
  dueDate: string;
  installmentCode: string;
  percentage: number;
  amountDue: number;
  vat: number;
  total: number;
  paid: number;
  outstanding: number;
}

const PaymentPlansSection = ({ propertyId }: { propertyId: string }) => {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newPlan, setNewPlan] = useState<Partial<PaymentPlan>>({});

  const loadPlans = useCallback(async () => {
    try {
      const res = await api.get(`/properties/${propertyId}/payment-plans`);
      const sorted = [...res.data].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setPlans(sorted);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load payment plans');
    }
  }, [propertyId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/properties/payment-plans/${id}`);
      loadPlans();
    } catch (err) {
      Alert.alert('Error', 'Failed to delete plan');
    }
  };

  const handleAdd = async () => {
    const plan = {
      ...newPlan,
      total: (newPlan.amountDue || 0) + (newPlan.vat || 0),
      dueDate: new Date(newPlan.dueDate || '').toISOString(),
      eventDate: newPlan.eventDate ? new Date(newPlan.eventDate).toISOString() : undefined,
    };

    try {
      await api.post(`/properties/${propertyId}/payment-plans`, plan);
      setShowModal(false);
      setNewPlan({});
      loadPlans();
    } catch (err) {
      Alert.alert('Error', 'Failed to add payment plan');
    }
  };

  const parseNumber = (text: string) => {
    const value = parseFloat(text);
    return isNaN(value) ? 0 : value;
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>📅 Payment Plans</Text>
      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.planCard}>
            <Text style={styles.bold}>{item.milestone}</Text>
            {item.eventDate && <Text>📌 Event: {new Date(item.eventDate).toLocaleDateString()}</Text>}
            <Text>🗓 Due: {new Date(item.dueDate).toLocaleDateString()}</Text>
            <Text>💬 Installment: {item.installmentCode}</Text>
            <Text>📊 {item.percentage}% of price</Text>
            <Text>💵 Amount: {item.amountDue} + VAT: {item.vat} = Total: {item.total}</Text>
            <Text>✅ Paid: {item.paid} | 🔸 Outstanding: {item.outstanding}</Text>
            <Button title="❌ Delete" onPress={() => handleDelete(item.id)} color="red" />
          </View>
        )}
      />
      <Button title="➕ Add Payment Plan" onPress={() => setShowModal(true)} />

      <Modal visible={showModal} animationType="slide">
        <ScrollView style={styles.modalContent}>
          <Text style={styles.title}>Add Payment Plan</Text>
          <StyledInput placeholder="Milestone" style={styles.input} onChangeText={(text) => setNewPlan(p => ({ ...p, milestone: text }))} />
          <StyledInput
              placeholder="Due Date (YYYY-MM-DD)"
              style={styles.input}
              keyboardType="numeric"
              value={newPlan.dueDate || ''}
              onChangeText={(text) => {
                const numbersOnly = text.replace(/\D/g, ''); //numbers
                let formatted = numbersOnly;

                if (numbersOnly.length > 4) {
                  formatted = numbersOnly.slice(0, 4) + '-' + numbersOnly.slice(4);
                }
                if (numbersOnly.length > 6) {
                  formatted = numbersOnly.slice(0, 4) + '-' + numbersOnly.slice(4, 6) + '-' + numbersOnly.slice(6, 8);
                }

                setNewPlan(p => ({ ...p, dueDate: formatted }));
              }}
            />

          <StyledInput placeholder="Installment Code" style={styles.input} onChangeText={(text) => setNewPlan(p => ({ ...p, installmentCode: text }))} />
          <StyledInput placeholder="Percentage" style={styles.input} keyboardType="numeric" onChangeText={(text) => setNewPlan(p => ({ ...p, percentage: parseNumber(text) }))} />
          <StyledInput placeholder="Amount Due" style={styles.input} keyboardType="numeric" onChangeText={(text) => setNewPlan(p => ({ ...p, amountDue: parseNumber(text) }))} />
          <StyledInput placeholder="VAT" style={styles.input} keyboardType="numeric" onChangeText={(text) => setNewPlan(p => ({ ...p, vat: parseNumber(text) }))} />
          <StyledInput placeholder="Paid" style={styles.input} keyboardType="numeric" onChangeText={(text) => setNewPlan(p => ({ ...p, paid: parseNumber(text) }))} />
          <Button title="💾 Save" onPress={handleAdd} />
          <Button title="Cancel" onPress={() => setShowModal(false)} color="gray" />
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  planCard: {
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
  },
  modalContent: { padding: 20 },
  title: { fontSize: 20, marginBottom: 20, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  bold: {
    fontWeight: 'bold',
  },
});

export default PaymentPlansSection;
