import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList,  StyleSheet, Alert } from 'react-native';
import api from '../api';
import BlueButton from '../components/BlueButton';
//import { useUser } from '../contexts/UserContext';

interface InvestmentApplication {
  id: string;
  userId: string;
  propertyId: string;
  requestedAmount: number;
  requestedShares: number;
  approvedAmount?: number;
  approvedShares?: number;
  stepNumber: number;
  status?: string;
  isPriority: boolean;
  createdAt: string;
}

const AdminInvestmentApplicationScreen = () => {
  //const { user } = useUser();
  const [applications, setApplications] = useState<InvestmentApplication[]>([]);
  const [propertyId, setPropertyId] = useState<string>('');

  const fetchApplications = useCallback(async () => {
    if (!propertyId) return;
    try {
      const response = await api.get(`/applications/property/${propertyId}`);
      setApplications(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load applications');
    }
  }, [propertyId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleApprove = async (id: string, shares: number) => {
    try {
      await api.post(`/applications/${id}/approve`, shares);
      Alert.alert('Success', 'Application approved');
      fetchApplications();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve application');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.post(`/applications/${id}/reject`);
      fetchApplications();
    } catch {
      Alert.alert('Error', 'Failed to reject application');
    }
  };

  const handleCarry = async (id: string) => {
    try {
      await api.post(`/applications/${id}/carry`);
      fetchApplications();
    } catch {
      Alert.alert('Error', 'Failed to carry application');
    }
  };

  const handleTogglePriority = async (id: string, current: boolean) => {
    try {
      await api.post(`/applications/${id}/update-priority`, !current);
      fetchApplications();
    } catch {
      Alert.alert('Error', 'Failed to update priority');
    }
  };

  const handleRecalculate = async () => {
    try {
      await api.post(`/applications/recalculate-priority/${propertyId}`);
      fetchApplications();
    } catch {
      Alert.alert('Error', 'Failed to recalculate priority');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Applications</Text>

      <Text>Enter Property ID:</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={propertyId}
          onChangeText={setPropertyId}
          placeholder="Property ID"
        />
        <BlueButton title="Load" onPress={fetchApplications} />
      </View>

      <BlueButton   title="Recalculate Priority" onPress={handleRecalculate} variant="orange" />

      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>ID: {item.id}</Text>
            <Text>User: {item.userId}</Text>
            <Text>Amount: {item.requestedAmount}</Text>
            <Text>Shares: {item.requestedShares}</Text>
            <Text>Status: {item.status || 'pending'}</Text>
            <Text>Step: {item.stepNumber}</Text>
            <Text>Priority: {item.isPriority ? '✅' : '❌'}</Text>

            <View style={styles.buttonRow}>
              <BlueButton title="✔ Approve" onPress={() => handleApprove(item.id, item.requestedShares)} />
              <BlueButton title="✖ Reject" onPress={() => handleReject(item.id)} />
              <BlueButton title="↪ Carry" onPress={() => handleCarry(item.id)} />
              <BlueButton 
                title={item.isPriority ? 'Remove ⭐' : 'Make ⭐'}
                onPress={() => handleTogglePriority(item.id, item.isPriority)}
              />
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  input: { flex: 1, borderColor: '#ccc', borderWidth: 1, marginRight: 10, padding: 8, borderRadius: 5 },
  card: {
    padding: 10,
    marginVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
});

export default AdminInvestmentApplicationScreen;
