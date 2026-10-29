import React, {useCallback, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {View, Text, Pressable, ActivityIndicator} from 'react-native';
import {useQuery} from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import theme from '../constants/theme';
import ErrorState from './ErrorState';
type Notification = {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};
export default function InboxNotifications() {
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let active = true;
    setSessionLoading(true);
    void AsyncStorage.getItem('user').then(raw => {
      const user = raw ? JSON.parse(raw) : null;
      if (active) setUserId(user?.userId ?? user?.id ?? user?.user?.id ?? null);
    }).catch(() => {if (active) setUserId(null);})
      .finally(() => {if (active) setSessionLoading(false);});
    return () => {active = false;};
  }, []));
  const query = useQuery({
    queryKey: ['inboxNotifications', userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await api.get(`/notifications/${userId}`, {
        silentLoading: true,
        silentError: true,
      } as any);
      return (Array.isArray(res.data) ? res.data : []) as Notification[];
    },
  });
  // Notifications are read-only here; Inbox keeps its existing message-read action.
  return (
    <View
      style={{
        gap: 12,
        paddingVertical: 24,
        borderTopWidth: 1,
        borderColor: theme.colors.border,
      }}>
      <Text style={{fontSize: 20, fontWeight: '600', color: theme.colors.text}}>
        Notifications
      </Text>
      {sessionLoading || query.isLoading ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Loading notifications">
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={{color: theme.colors.textSecondary}}>
            Loading notifications…
          </Text>
        </View>
      ) : query.isError || !userId ? (
        <ErrorState
          title="Unable to load notifications"
          onRetry={() => {
            void query.refetch();
          }}
          isRetrying={query.isFetching}
        />
      ) : !query.data?.length ? (
        <Text style={{color: theme.colors.textSecondary}}>
          No notifications yet.
        </Text>
      ) : (
        query.data.map(item => (
          <View
            key={item.id}
            style={{
              padding: 14,
              gap: 8,
              borderRadius: 12,
              backgroundColor: item.isRead ? theme.colors.surface : '#e6f4ec',
            }}>
            <Text style={{color: theme.colors.text, lineHeight: 22}}>
              {item.message}
            </Text>
            <Text style={{color: theme.colors.textSecondary, fontSize: 12}}>
              {item.isRead ? 'Read' : 'Unread'} ·{' '}
              {new Date(item.createdAt).toLocaleString('en-US')}
            </Text>
          </View>
        ))
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void query.refetch();
        }}
        disabled={query.isFetching}
        style={{minHeight: 44, justifyContent: 'center'}}>
        <Text style={{color: theme.colors.primary}}>Refresh notifications</Text>
      </Pressable>
    </View>
  );
}
