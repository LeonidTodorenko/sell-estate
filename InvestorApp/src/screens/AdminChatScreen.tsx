import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import api from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import theme from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_BAR_HEIGHT } from '../components/BottomBar';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface User {
  id: string;
  fullName?: string;
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

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshingUsers, setRefreshingUsers] = useState(false);
  const [refreshingMessages, setRefreshingMessages] = useState(false);

  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const bottomPad = Math.max(insets.bottom, 8);
  const barHeight = BOTTOM_BAR_HEIGHT + bottomPad;
  const keyboardOffset = BOTTOM_BAR_HEIGHT + Math.max(insets.bottom, 8);
  const COMPOSER_HEIGHT = 68;

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  };

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);

      const stored = await AsyncStorage.getItem('user');
      if (!stored) {
        setLoadingUsers(false);
        return;
      }

      const admin = JSON.parse(stored);
      const uid = admin.userId ?? admin.id ?? admin?.user?.id;
      if (!uid) {
        setLoadingUsers(false);
        return;
      }

      setAdminId(uid);

      const usersRes = await api.get('/chat/conversations');
      const data = Array.isArray(usersRes.data) ? usersRes.data : [];
      setUsers(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load conversations');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (user: User) => {
      try {
        if (!adminId || !user?.id) return;

        setLoadingMessages(true);
        const res = await api.get(`/chat/conversation/${adminId}/${user.id}`);
        const data: ChatMessage[] = Array.isArray(res.data) ? res.data : [];

        const sorted = [...data].sort(
          (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
        );

        setMessages(sorted);
        setTimeout(scrollToBottom, 50);
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Failed to load messages');
      } finally {
        setLoadingMessages(false);
      }
    },
    [adminId],
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const selectUser = async (user: User) => {
    setSelectedUser(user);
    await loadMessages(user);
  };

  const onRefreshUsers = useCallback(async () => {
    setRefreshingUsers(true);
    await loadUsers();
    setRefreshingUsers(false);
  }, [loadUsers]);

  const onRefreshMessages = useCallback(async () => {
    if (!selectedUser) return;
    setRefreshingMessages(true);
    await loadMessages(selectedUser);
    setRefreshingMessages(false);
  }, [selectedUser, loadMessages]);

  const sendMessage = async () => {
    const text = input.trim();

    if (!text || !selectedUser) return;

    try {
      setSending(true);

      const optimistic: ChatMessage = {
        id: `tmp-${Date.now()}`,
        senderId: adminId,
        recipientId: selectedUser.id,
        content: text,
        sentAt: new Date().toISOString(),
      };

      setMessages((prev) => [optimistic, ...prev]);
      setInput('');
      setTimeout(scrollToBottom, 50);

      await api.post('/chat/send', {
        recipientId: selectedUser.id,
        content: text,
      });

      await loadMessages(selectedUser);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => selectUser(item)}
      style={styles.userCard}
    >
      <View style={styles.userAvatar}>
        <Text style={styles.userAvatarText}>
          {(item.fullName || item.email || 'U').charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.userTextWrap}>
        <Text style={styles.userName} numberOfLines={1}>
          {item.fullName || 'User'}
        </Text>
        <Text style={styles.userEmail} numberOfLines={1}>
          {item.email}
        </Text>
      </View>

      <Ionicons name="chevron-forward-outline" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isMine = item.senderId === adminId;
    const time = item.sentAt
      ? new Date(item.sentAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return (
      <View style={[styles.messageRow, isMine ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.messageText, isMine && styles.messageTextMine]}>
            {item.content}
          </Text>
          <Text style={[styles.timeText, isMine && styles.timeTextMine]}>{time}</Text>
        </View>
      </View>
    );
  };

  if (loadingUsers && !selectedUser) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading conversations…</Text>
      </View>
    );
  }

  if (!selectedUser) {
    return (
      <View style={styles.container}>
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.usersListContent}
          refreshControl={
            <RefreshControl refreshing={refreshingUsers} onRefresh={onRefreshUsers} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtitle}>
                When users write to support, they will appear here
              </Text>
            </View>
          }
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardOffset}
    >
      <View style={styles.chatTopBar}>
        <TouchableOpacity
          onPress={() => {
            setSelectedUser(null);
            setMessages([]);
            setInput('');
          }}
          style={styles.topBackButton}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {selectedUser.fullName || selectedUser.email}
          </Text>
          {!!selectedUser.fullName && (
            <Text style={styles.topBarSubtitle} numberOfLines={1}>
              {selectedUser.email}
            </Text>
          )}
        </View>

        <View style={styles.topBarSpacer} />
      </View>

      {loadingMessages ? (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading messages…</Text>
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            inverted
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: COMPOSER_HEIGHT + barHeight + 8,
              paddingBottom: 14,
              paddingHorizontal: 8,
              flexGrow: messages.length === 0 ? 1 : undefined,
            }}
            refreshControl={
              <RefreshControl refreshing={refreshingMessages} onRefresh={onRefreshMessages} />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No messages here yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start the conversation with this user
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
            ]}
          >
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Enter your message"
              placeholderTextColor="#A1A1AA"
              multiline
              maxLength={2000}
            />

            <TouchableOpacity
              onPress={sendMessage}
              disabled={sending || input.trim().length === 0}
              style={[
                styles.sendBtn,
                (sending || input.trim().length === 0) && styles.sendBtnDisabled,
              ]}
              activeOpacity={0.85}
            >
              {sending ? (
                <Text style={styles.sendBtnText}>…</Text>
              ) : (
                <Ionicons name="send" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
};

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

  usersListContent: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },

  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  userAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },

  userTextWrap: {
    flex: 1,
    paddingRight: 8,
  },

  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },

  userEmail: {
    marginTop: 2,
    fontSize: 12,
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
    color: '#A1A1AA',
    textAlign: 'center',
  },

  chatTopBar: {
    height: 62,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },

  topBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },

  topBarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },

  topBarSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },

  topBarSpacer: {
    width: 36,
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
    backgroundColor: '#11A36A',
    borderBottomRightRadius: 6,
  },

  bubbleOther: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 6,
  },

  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
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
    borderColor: '#E5E7EB',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    fontSize: 14,
    color: theme.colors.text,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },

  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#11A36A',
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

export default AdminChatScreen;