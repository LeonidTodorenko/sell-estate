// screens/InboxScreen.tsx
import React, { useEffect, useState } from 'react';
import { Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

interface Message {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

const InboxScreen = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const loadMessages = async () => {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;
      const user = JSON.parse(stored);
      setUserId(user.id);
      const res = await api.get(`/messages/inbox/${user.id}`);
      setMessages(res.data);
    };

    loadMessages();
  }, []);

  const markAsRead = async (id: string) => {
    await api.post(`/messages/${id}/mark-read`);
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, isRead: true } : m)));
  };

  const handlePress = (msg: Message) => {
    Alert.alert(msg.title, msg.content);
    if (!msg.isRead) markAsRead(msg.id);
  };

  return (
    <FlatList
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => handlePress(item)} style={[styles.msg, item.isRead ? styles.read : styles.unread]}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
        </TouchableOpacity>
      )}
      contentContainerStyle={{ padding: 16 }}
    />
  );
};

const styles = StyleSheet.create({
  msg: {
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 6,
  },
  read: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ccc',
  },
  unread: {
    backgroundColor: '#fffaf0',
    borderColor: '#f39c12',
  },
  title: {
    fontWeight: 'bold',
  },
  date: {
    fontSize: 12,
    color: '#777',
  },
});

export default InboxScreen;
