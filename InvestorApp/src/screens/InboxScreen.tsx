import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import theme from '../constants/theme';
import AnimatedCard from '../components/AnimatedCard';
import ErrorState from '../components/ErrorState';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// одна иконка для всех
import bellIcon from '../assets/images/history14.png';

interface Message {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

type Section = {
  title: string;
  data: Message[];
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatSectionTitle(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
  });
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function fetchInbox(): Promise<Message[]> {
  const stored = await AsyncStorage.getItem('user');
  if (!stored) return [];

  const user = JSON.parse(stored);
  const userId = user?.userId ?? user?.id;
  if (!userId) return [];

  const res = await api.get(`/messages/inbox/${userId}`, {
    silentLoading: true,
    silentError: true,
    errorContext: 'Failed to get inbox',
    errorTitle: 'Inbox',
  } as any);

  return Array.isArray(res.data) ? res.data : [];
}

const InboxScreen = () => {
  const queryClient = useQueryClient();

  const {
    data: messages = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery<Message[]>({
    queryKey: ['inbox'],
    queryFn: fetchInbox,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/messages/${id}/mark-read`, undefined, {
        silentLoading: true,
        silentError: true,
      } as any);

      return id;
    },

    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['inbox'] });

      const previousMessages =
        queryClient.getQueryData<Message[]>(['inbox']) ?? [];

      queryClient.setQueryData<Message[]>(['inbox'], (current = []) =>
        current.map((message) =>
          message.id === id ? { ...message, isRead: true } : message
        )
      );

      return { previousMessages };
    },

    onError: (_error, _id, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(['inbox'], context.previousMessages);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['unreadMessages'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });

  const handlePress = (msg: Message) => {
    Alert.alert(msg.title, msg.content);

    if (!msg.isRead && !markAsReadMutation.isPending) {
      markAsReadMutation.mutate(msg.id);
    }
  };

  // 🔥 группировка
  const sections = useMemo<Section[]>(() => {
    const groups: Record<string, Message[]> = {};

    messages
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )
      .forEach((msg) => {
        const key = new Date(msg.createdAt).toDateString();
        if (!groups[key]) groups[key] = [];
        groups[key].push(msg);
      });

    return Object.values(groups).map((group) => ({
      title: formatSectionTitle(group[0].createdAt),
      data: group,
    }));
  }, [messages]);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (isError && messages.length === 0) {
    return (
      <ErrorState
        title="Unable to load notifications"
        description="Please check your connection and try again."
        onRetry={() => refetch()}
        isRetrying={isFetching}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={theme.colors.primary}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.section}>{section.title}</Text>
        )}
        renderItem={({ item, index, section }) => (
          <AnimatedCard delay={Math.min(index, 5) * 55}>
          <Pressable onPress={() => handlePress(item)} style={styles.row}>
            {/* LEFT */}
            <View style={styles.left}>
              <View style={styles.iconCircle}>
                <Image source={bellIcon} style={styles.icon} />
              </View>

              <View style={styles.textBlock}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle} numberOfLines={2}>
                  {item.content}
                </Text>
              </View>
            </View>

            {/* RIGHT */}
            <View style={styles.right}>
              {!item.isRead && <View style={styles.dot} />}

              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
            </View>

            {/* divider */}
            {index !== section.data.length - 1 && (
              <View style={styles.divider} />
            )}
          </Pressable>
          </AnimatedCard>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
};

export default InboxScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  list: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  section: {
    fontSize: 18,
    color: '#A3A3A3',
    marginTop: 18,
    marginBottom: 12,
  },

  row: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },

  left: {
    flexDirection: 'row',
    flex: 1,
    paddingRight: 12,
  },

  iconCircle: {
    // width: 52,
    // height: 52,
    // borderRadius: 26,
    // backgroundColor: '#EAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  icon: {
    width: 52,
    height: 52,
  },

  textBlock: {
    flex: 1,
  },

  title: {
    fontSize: 17,
    fontWeight: '500',
    color: theme.colors.text,
  },

  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: '#A3A3A3',
  },

  right: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  time: {
    fontSize: 13,
    color: '#B6B6B6',
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    marginBottom: 6,
  },

  divider: {
    position: 'absolute',
    left: 66,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: '#ECECEC',
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  empty: {
    flex: 1,
    paddingTop: 80,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
});
