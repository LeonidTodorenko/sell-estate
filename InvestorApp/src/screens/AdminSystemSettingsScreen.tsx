import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet, ScrollView } from 'react-native';
import api from '../api';

interface SystemSetting {
  key: string;
  value: string;
}

const AdminSystemSettingsScreen = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [edited, setEdited] = useState<{ [key: string]: string }>({});

  const loadSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setSettings(res.data);
      const initEdited: { [key: string]: string } = {};
      res.data.forEach((s: SystemSetting) => {
        initEdited[s.key] = s.value;
      });
      setEdited(initEdited);
    } catch (err) {
      Alert.alert('Error', 'Failed to load settings');
    }
  };

  const saveSetting = async (key: string) => {
    try {
      await api.put(`/admin/settings/${key}`, { value: edited[key] });
      Alert.alert('Success', `${key} updated`);
      loadSettings();
    } catch {
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>System Settings</Text>
      {settings.map((s) => (
        <View key={s.key} style={styles.settingBlock}>
          <Text style={styles.label}>{s.key}</Text>
          <TextInput
            style={styles.input}
            value={edited[s.key]}
            onChangeText={(text) => setEdited((prev) => ({ ...prev, [s.key]: text }))}
            keyboardType="numeric"
          />
          <Button title="Save" onPress={() => saveSetting(s.key)} />
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  settingBlock: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: 'bold' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginVertical: 8,
    borderRadius: 6,
  },
});

export default AdminSystemSettingsScreen;
