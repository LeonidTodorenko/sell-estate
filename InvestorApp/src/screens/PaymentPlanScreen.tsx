import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text,  StyleSheet, ScrollView } from 'react-native';
import api from '../api';
import AddPaymentPlanModal from '../components/AddPaymentPlanModal';
import PaymentPlanTable from '../components/PaymentPlanTable';
import BlueButton from '../components/BlueButton';

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

const PaymentPlanScreen = ({ route }: any) => {
  const { propertyId, readonly } = route.params;
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [showModal, setShowModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const loadPlans = useCallback(async () => {
    try {
      const res = await api.get(`/properties/${propertyId}/payment-plans`);
      const sorted = [...res.data].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setPlans(sorted);
    } catch (err) {
      console.error(err);
    }
  }, [propertyId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handlePlanAdded = async () => {
    await loadPlans();
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📋 Payment Plan</Text>
      {!readonly && (
        <BlueButton title="➕ Add Payment Plan" onPress={() => setShowModal(true)} />
      )}
    

      <ScrollView ref={scrollViewRef} style={styles.tableContainer} horizontal>
        <PaymentPlanTable plans={plans} reload={loadPlans}   propertyId={propertyId}  readonly={readonly} />
      </ScrollView>

      <AddPaymentPlanModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        propertyId={propertyId}
        onAdded={handlePlanAdded}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  tableContainer: {
    marginTop: 10,
  },
});

export default PaymentPlanScreen;
