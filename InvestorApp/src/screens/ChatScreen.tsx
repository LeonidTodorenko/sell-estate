import React, {useRef, useState, useCallback} from 'react';
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
import ErrorState from '../components/ErrorState';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {BOTTOM_BAR_HEIGHT} from '../components/BottomBar';
import Ionicons from 'react-native-vector-icons/Ionicons';

// These requests are represented by local loading/error UI.
const localRequestUI = {silentLoading: true, silentError: true} as any;

interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  sentAt: string;
  isRead?: boolean;
}

const ChatScreen = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [userId, setUserId] = useState('');
  const [adminId, setAdminId] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const sendingRef = useRef(false);

  const insets = useSafeAreaInsets();
  const bottomOffset = BOTTOM_BAR_HEIGHT + Math.max(insets.bottom, 8);

  const listRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({offset: 0, animated: true});
    });
  };

  const loadChat = useCallback(async () => {
    try {
      setLoadError(false);
      const stored = await AsyncStorage.getItem('user');
      if (!stored) {
        setLoading(false);
        return;
      }

      const user = JSON.parse(stored);
      const demo = user.isDemo === true || user.user?.isDemo === true;
      setIsDemo(demo);
      const uid = user.userId ?? user.id ?? user?.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }

      setUserId(uid);

      if (demo) {
        setMessages([]);
        setLoading(false);
        return;
      }

      const adminRes = await api.get('/users/admin-id', localRequestUI);
      const aid = adminRes.data?.adminId;
      if (!aid) {
        setLoading(false);
        return;
      }

      setAdminId(aid);

      const chatRes = await api.get(`/chat/conversation/${uid}/${aid}`, localRequestUI);
      const data: ChatMessage[] = Array.isArray(chatRes.data)
        ? chatRes.data
        : [];

      const sorted = [...data].sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
      );

      setMessages(sorted);
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (messages.length === 0) {
        setLoading(true);
      }

      loadChat();

      const id = setInterval(loadChat, 5000);
      return () => clearInterval(id);
    }, [loadChat, messages.length]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChat();
    setRefreshing(false);
  }, [loadChat]);

  const sendMessage = async () => {
    if (sendingRef.current) return;
    if (isDemo) {
      Alert.alert(
        'Demo Mode',
        'Live support chat is disabled in the sandbox. No message will be sent.',
      );
      return;
    }
    const text = input.trim();

    if (!text || !userId || !adminId) {
      Alert.alert('Error', 'Message is empty or user/admin not loaded');
      return;
    }

    try {
      sendingRef.current = true;
      setSending(true);

      await api.post('/chat/send', {
        recipientId: adminId,
        content: text,
      }, localRequestUI);
      setInput('');

      const res = await api.get(`/chat/conversation/${userId}/${adminId}`, localRequestUI);
      const data: ChatMessage[] = Array.isArray(res.data) ? res.data : [];
      const sorted = [...data].sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
      );

      setMessages(sorted);
      setTimeout(scrollToBottom, 50);
    } catch (error) {
      console.error('Failed to send message', error);
      Alert.alert(
        'Message not confirmed',
        'Your text is kept if sending failed. Delivery may be uncertain; refresh the conversation before sending again.',
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const renderItem = ({item}: {item: ChatMessage}) => {
    const isMine = item.senderId === userId;
    const time = item.sentAt
      ? new Date(item.sentAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return (
      <View
        style={[styles.messageRow, isMine ? styles.rowRight : styles.rowLeft]}>
        <View
          style={[
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleOther,
          ]}>
          <Text style={[styles.messageText, isMine && styles.messageTextMine]}>
            {item.content}
          </Text>
          <Text style={[styles.timeText, isMine && styles.timeTextMine]}>
            {time}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading chat…</Text>
      </View>
    );
  }

  if (loadError && messages.length === 0)
    return (
      <ErrorState
        title="Unable to load chat"
        onRetry={onRefresh}
        isRetrying={refreshing}
      />
    );

  if (isDemo) {
    return (
      <View style={[styles.container, styles.center, {paddingHorizontal: 28}]}>
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={48}
          color={theme.colors.primary}
        />
        <Text style={[styles.emptyTitle, {marginTop: 16}]}>
          Chat is read-only in Demo Mode
        </Text>
        <Text style={styles.emptySubtitle}>
          Messages are not sent to production support from sandbox accounts.
        </Text>
      </View>
    );
  }

  const COMPOSER_HEIGHT = 68;
  const bottomPad = Math.max(insets.bottom, 8);
  const barHeight = BOTTOM_BAR_HEIGHT + bottomPad;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={bottomOffset}>
      {loadError && (
        <Text
          accessibilityRole="alert"
          style={{padding: 12, color: theme.colors.danger}}>
          Refresh failed. Pull down to retry.
        </Text>
      )}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        inverted
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: COMPOSER_HEIGHT + barHeight + 8,
          paddingBottom: 14,
          paddingHorizontal: 8,
          flexGrow: messages.length === 0 ? 1 : undefined,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No messages here yet</Text>
            <Text style={styles.emptySubtitle}>
              Write something to start the conversation
            </Text>
          </View>
        }
      />

      <View
        style={[
          styles.composer,
          {
            bottom: barHeight,
            paddingBottom: 0,
          },
        ]}>
        <TextInput
          style={styles.input}
          value={input}
          editable={!sending}
          onChangeText={setInput}
          placeholder="Enter your question"
          placeholderTextColor="#52675e"
          multiline
          scrollEnabled
          textAlignVertical="center"
          maxLength={2000}
        />

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Send message"
          onPress={sendMessage}
          disabled={sending || !userId || !adminId || input.trim().length === 0}
          style={[
            styles.sendBtn,
            (sending || input.trim().length === 0) && styles.sendBtnDisabled,
          ]}
          activeOpacity={1}>
          {sending ? (
            <Text style={styles.sendBtnText}>…</Text>
          ) : (
            <Ionicons name="send" size={16} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },

  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },

  emptySubtitle: {
    fontSize: 12,
    color: '#52675e',
    textAlign: 'center',
  },

  messageRow: {
    paddingHorizontal: 8,
    marginVertical: 4,
  },

  rowLeft: {
    alignItems: 'flex-start',
  },

  rowRight: {
    alignItems: 'flex-end',
  },

  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  bubbleMine: {
    backgroundColor: '#098653',
    borderBottomRightRadius: 6,
  },

  bubbleOther: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 6,
  },

  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#18382c',
  },

  messageTextMine: {
    color: '#FFFFFF',
  },

  timeText: {
    marginTop: 6,
    fontSize: 10,
    color: '#9CA3AF',
    alignSelf: 'flex-end',
  },

  timeTextMine: {
    color: 'rgba(255,255,255,0.82)',
  },

  composer: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dce7e0',
    paddingLeft: 8,
    paddingRight: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 3},
    elevation: 9,
  },

  attachButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },

  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    fontSize: 14,
    color: theme.colors.text,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'transparent',
    textAlignVertical: 'center',
  },

  sendBtn: {
    width: 48,
    height: 48,

    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#098653',
    marginLeft: 8,
  },

  sendBtnDisabled: {
    opacity: 0.5,
  },

  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
