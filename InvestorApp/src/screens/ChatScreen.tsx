import React, {   useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import theme from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
//import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { BOTTOM_BAR_HEIGHT } from '../components/BottomBar';

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
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);



  //const tabBarHeight = React.useContext(BottomTabBarHeightContext) ?? 0;
  const insets = useSafeAreaInsets();
  const bottomOffset = BOTTOM_BAR_HEIGHT + Math.max(insets.bottom, 8);

  //const bottomOffset = tabBarHeight + insets.bottom;

  const listRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  };

  const loadChat = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) {
        setLoading(false);
        return;
      }

      const user = JSON.parse(stored);
    const uid = user.userId ?? user.id ?? user?.user?.id;
      if (!uid) { setLoading(false); return; }
      setUserId(uid);

      const adminRes = await api.get('/users/admin-id');
      const aid = adminRes.data?.adminId;
      setAdminId(aid);

      const chatRes = await api.get(`/chat/conversation/${uid}/${aid}`);

      // Важно: чтобы inversion работал как чат — нам нужны сообщения от новых к старым.
      // Если API уже отдаёт по времени — ок. Если старые->новые, разворачиваем:
      const data: ChatMessage[] = Array.isArray(chatRes.data) ? chatRes.data : [];
      const sorted = [...data].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

      setMessages(sorted);
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, []);

  // useEffect(() => {
  //   loadChat();
  // }, [loadChat]);

 useFocusEffect(
  useCallback(() => {
    if (messages.length === 0) {setLoading(true);}
    loadChat();

    const id = setInterval(loadChat, 5000);
    return () => clearInterval(id);
  }, [loadChat, messages.length])
);


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChat();
    setRefreshing(false);
  }, [loadChat]);

  const sendMessage = async () => {
    const text = input.trim();

    if (!text || !userId || !adminId) {
      Alert.alert('Error', 'Message is empty or user/admin not loaded');
      return;
    }

    try {
      setSending(true);

      // оптимистично добавим в UI, чтобы было “как мессенджер”
      const optimistic: ChatMessage = {
        id: `tmp-${Date.now()}`,
        senderId: userId,
        recipientId: adminId,
        content: text,
        sentAt: new Date().toISOString(),
      };

      setMessages(prev => [optimistic, ...prev]);
      setInput('');
      setTimeout(scrollToBottom, 50);

      await api.post('/chat/send', {
        //senderId: userId,
        recipientId: adminId,
        content: text,
      });

      // после реальной отправки — перезагрузим (чтобы получить настоящий id/время)
      const res = await api.get(`/chat/conversation/${userId}/${adminId}`);
      const data: ChatMessage[] = Array.isArray(res.data) ? res.data : [];
      const sorted = [...data].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
      setMessages(sorted);

      setTimeout(scrollToBottom, 50);
    } catch (error) {
      console.error('Failed to send message', error);
      Alert.alert('Error', 'Failed to send message');
      // можно откатить optimistic, но пока оставим (или скажи — сделаю)
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMine = item.senderId === userId;

    const label = isMine ? 'user:' : 'admin:';
    const time = item.sentAt ? new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <View style={[styles.messageRow, isMine ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={styles.subLabel}>{label}</Text>
          <Text style={styles.messageText}>{item.content}</Text>
          <Text style={styles.timeText}>{time}</Text>
        </View>
      </View>
    );
  };

//     useFocusEffect(
//   useCallback(() => {
//     // при входе на экран
//     loadChat();

//     const id = setInterval(() => {
//       loadChat();
//     }, 5000);

//     // при уходе с экрана
//     return () => clearInterval(id);
//   }, [loadChat])
// );



  

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading chat…</Text>
      </View>
    );
  }


//   useEffect(() => {
//   loadChat();

//   const interval = setInterval(() => {
//     loadChat();
//   }, 5000); // каждые 5 сек

//   return () => clearInterval(interval);
// }, [loadChat]);

  const COMPOSER_HEIGHT = 64;
  const bottomPad = Math.max(insets.bottom, 8);
const barHeight = BOTTOM_BAR_HEIGHT + bottomPad;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={bottomOffset}
    >
      {/* Список сообщений */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        inverted
      contentContainerStyle={{
  paddingVertical: 10,
  paddingTop: COMPOSER_HEIGHT + barHeight + 8,  
  paddingBottom: 10,
}}

        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ color: '#666' }}>No messages yet. Say hi 👋</Text>
          </View>
        }
      />

      {/* Панель ввода снизу */}
       <View style={[styles.composer,   {
          paddingBottom: 0,
          bottom: barHeight,
        },]}>
        <TextInput
          style={[styles.input, { maxHeight: 110 }]}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message…"
          multiline 
        />
  
        <TouchableOpacity
          onPress={sendMessage}
          disabled={sending || input.trim().length === 0}
          style={[
            styles.sendBtn,
            (sending || input.trim().length === 0) && styles.sendBtnDisabled,
          ]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.sendBtnText}>{sending ? '…' : '➤'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },

  messageRow: {
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  rowLeft: { alignItems: 'flex-start' },
  rowRight: { alignItems: 'flex-end' },

  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: '#E9D5FF', // light purple
    borderColor: '#C084FC',
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDD',
  },

  subLabel: {
    fontSize: 11,
    color: '#555',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    color: '#111',
  },
  timeText: {
    marginTop: 4,
    fontSize: 10,
    color: '#777',
    alignSelf: 'flex-end',
  },

composer: {
  position: 'absolute',
  left: 0,
  right: 0,
  // bottom задаём инлайн через tabBarHeight
  flexDirection: 'row',
  alignItems: 'flex-end',
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderTopWidth: 1,
  borderColor: '#e5e5e5',
  backgroundColor: '#fff',
 
},

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  sendBtn: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7C3AED', // purple
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
