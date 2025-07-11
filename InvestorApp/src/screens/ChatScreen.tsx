import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, Button, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  sentAt: string;
}

const ChatScreen = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [userId, setUserId] = useState('');
  const [adminId, setAdminId] = useState(''); 

  useEffect(() => {
    const loadChat = async () => {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;

      const user = JSON.parse(stored);
      setUserId(user.userId);
 
      const adminRes = await api.get('/users/admin-id');
      const admin = adminRes.data;
   
      setAdminId(admin.adminId);

   const chatRes = await api.get(`/chat/conversation/${user.userId}/${admin.adminId}`);

      setMessages(chatRes.data);
    };

    loadChat();
  }, []);

  const sendMessage = async () => {

 if (!input || !userId || !adminId){
     console.error('Failed to send message, input:' + input + ';userId:' + userId + ';adminId:' + adminId);
    Alert.alert('Failed to send message  adminId:' + adminId);
    return;
 }
 
    try {
     await api.post('/chat/send', {
      senderId: userId,
      recipientId: adminId,
      content: input,
    });

    setInput('');
    const res = await api.get(`/chat/conversation/${userId}/${adminId}`);
    setMessages(res.data);
  } catch (error) {
    console.error('Failed to send message', error);
    Alert.alert('Failed to send message');
  }
  
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Text style={{ alignSelf: item.senderId === userId ? 'flex-end' : 'flex-start' }}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginTop: 10,
  },
});

export default ChatScreen;
