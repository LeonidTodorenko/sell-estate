import React, { useEffect, useState } from 'react';
import { View, Text,   StyleSheet, FlatList, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import api from '../api';
//import { useNavigation } from '@react-navigation/native';
import StyledInput from '../components/StyledInput';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';

interface Message {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  recipientId?: string;
  isRead: boolean;
}

interface User {
  id: string;
  fullName: string;
}

const AdminMessagesScreen = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [recipientId, setRecipientId] = useState<string>('');
  //const navigation = useNavigation();

  const loadMessages = async () => {
    const res = await api.get('/messages/all');
    setMessages(res.data);
  };

  const loadUsers = async () => {
    const res = await api.get('/users/all');
    setUsers(res.data);
  };

  useEffect(() => {
    loadMessages();
    loadUsers();
  }, []);

  const handleSend = async () => {
    if (!title || !content) {
      Alert.alert('Validation', 'Please fill Title and Content');
      return;
    }

    try {
      await api.post('/messages/send', {
        title,
        content,
        recipientId: recipientId || null,
      });
      Alert.alert('Success', 'Message sent');
      setTitle('');
      setContent('');
      setRecipientId('');
      loadMessages();
    }
    catch (error: any) {
             let message = 'Failed to send message ';
                  console.error(error);
                  if (error.response && error.response.data) {
                    message = JSON.stringify(error.response.data);
                  } else if (error.message) {
                    message = error.message;
                  }
                  Alert.alert('Error', 'Failed to send message ' + message);
                console.error(message);
          }
       
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>📨 Send New Message</Text>

      <StyledInput
        style={styles.input}
        placeholder="Title"
        value={title}
        onChangeText={setTitle}
      />
      <StyledInput
        style={[styles.input, { height: 80 }]}
        placeholder="Content"
        value={content}
        multiline
        onChangeText={setContent}
      />
      <Picker
        selectedValue={recipientId}
        onValueChange={(value: string) => setRecipientId(value)}
        style={styles.input}
      >
        <Picker.Item label="All Users" value="" />
        {users.map(user => (
          <Picker.Item key={user.id} label={user.fullName} value={user.id} />
        ))}
      </Picker>

      <BlueButton title="Send Message" onPress={handleSend} />

      <Text style={styles.header}>📋 Sent Messages</Text>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.messageItem}>
            <Text style={styles.messageTitle}>{item.title}</Text>
            <Text>{item.content}</Text>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
            <Text>{item.recipientId ? `Recipient: ${item.recipientId}` : 'For all users'}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.colors.background
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 12,
    padding: 10,
    borderRadius: 6,
  },
  messageItem: {
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
  },
  messageTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: 'gray',
    marginTop: 4,
  },
});

export default AdminMessagesScreen;
