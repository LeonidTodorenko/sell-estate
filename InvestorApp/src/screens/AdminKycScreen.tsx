import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet, Alert, Image } from 'react-native';
import api from '../api';

interface KycDoc {
  id: string;
  userId: string;
  type: string;
  base64File: string;
  status: string;
  uploadedAt: string;
}

const AdminKycScreen = () => {
  const [docs, setDocs] = useState<KycDoc[]>([]);

  const load = async () => {
    try {
      const res = await api.get('/kyc/pending');
      setDocs(res.data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load KYC documents');
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api.post(`/kyc/${id}/${action}`);
      Alert.alert('Success', `Document ${action}d`);
      load();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Document', 'Are you sure you want to delete this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/kyc/${id}/delete`);
            Alert.alert('Deleted');
            load();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete document');
          }
        },
      },
    ]);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>KYC Review</Text>
      <FlatList
        data={docs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>User ID: {item.userId}</Text>
            <Text>Type: {item.type}</Text>
            <Text>Status: {item.status}</Text>
            <Text>Uploaded: {new Date(item.uploadedAt).toLocaleDateString()}</Text>
            {item.base64File && (
              <Image
                source={{ uri: `data:image/jpeg;base64,${item.base64File}` }}
                style={styles.image}
              />
            )}
            <View style={styles.buttonRow}>
              <Button title="Approve" onPress={() => handleAction(item.id, 'approve')} />
              <Button title="Reject" color="red" onPress={() => handleAction(item.id, 'reject')} />
              <Button title="🗑 Delete" color="gray" onPress={() => handleDelete(item.id)} />
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: 'column',
    gap: 6,
    marginTop: 10,
  },
});

export default AdminKycScreen;
