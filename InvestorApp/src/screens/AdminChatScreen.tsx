import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, Button, StyleSheet, TouchableOpacity } from 'react-native';
import api from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  name: string;
  email: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  sentAt: string;
}

const AdminChatScreen = () => {
  const [adminId, setAdminId] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const load = async () => {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;
      const admin = JSON.parse(stored);
      setAdminId(admin.userId);

      const usersRes = await api.get('/chat/conversations');
      setUsers(usersRes.data);
    };

    load();
  }, []);

  const selectUser = async (user: User) => {
    setSelectedUser(user);
    const res = await api.get(`/chat/conversation/${adminId}/${user.id}`);
    setMessages(res.data);
  };

  const sendMessage = async () => {
    if (!input || !selectedUser) return;

    await api.post('/chat/send', {
      senderId: adminId,
      recipientId: selectedUser.id,
      content: input,
    });

    setInput('');
    const res = await api.get(`/chat/conversation/${adminId}/${selectedUser.id}`);
    setMessages(res.data);
  };

  return (
    <View style={styles.container}>
      {!selectedUser ? (
        <>
          <Text style={styles.title}>User Conversations</Text>
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => selectUser(item)} style={styles.userItem}>
                <Text>{item.name || item.email}</Text>
              </TouchableOpacity>
            )}
          />
        </>
      ) : (
        <>
          <Text style={styles.title}>Chat with {selectedUser.name || selectedUser.email}</Text>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Text style={{ alignSelf: item.senderId === adminId ? 'flex-end' : 'flex-start' }}>
                {item.content}
              </Text>
            )}
          />
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message"
          />
          <Button title="Send" onPress={sendMessage} />
          <Button title="Back to users" onPress={() => setSelectedUser(null)} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginVertical: 10 },
  userItem: { padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
});

export default AdminChatScreen;
