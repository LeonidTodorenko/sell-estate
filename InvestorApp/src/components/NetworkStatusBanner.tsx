import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import theme from '../constants/theme';
import { useNetwork } from '../contexts/NetworkContext';

const ONLINE_MESSAGE_DURATION = 2500;

/**
 * Глобальный баннер состояния сети.
 *
 * Offline:
 * - остаётся видимым, пока нет интернета.
 *
 * Back online:
 * - показывается ненадолго после восстановления соединения.
 */
export default function NetworkStatusBanner() {
  const { isOnline, isInitialized } = useNetwork();

  const [visible, setVisible] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  const previousOnlineRef = useRef<boolean | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const previousOnline = previousOnlineRef.current;

    if (!isOnline) {
      setShowBackOnline(false);
      setVisible(true);
    } else if (previousOnline === false) {
      setShowBackOnline(true);
      setVisible(true);

      const timeout = setTimeout(() => {
        setVisible(false);
      }, ONLINE_MESSAGE_DURATION);

      previousOnlineRef.current = isOnline;
      return () => clearTimeout(timeout);
    } else {
      setVisible(false);
    }

    previousOnlineRef.current = isOnline;
  }, [isInitialized, isOnline]);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -100,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [translateY, visible]);

  if (!isInitialized) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrapper,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        style={[
          styles.banner,
          showBackOnline ? styles.onlineBanner : styles.offlineBanner,
        ]}
      >
        <Text style={styles.title}>
          {showBackOnline ? 'Back online' : 'No internet connection'}
        </Text>

        <Text style={styles.description}>
          {showBackOnline
            ? 'The connection has been restored.'
            : 'Some information may be outdated.'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },

  banner: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  offlineBanner: {
    backgroundColor: theme.colors.warning,
    borderBottomColor: theme.colors.border,
  },

  onlineBanner: {
    backgroundColor: theme.colors.success,
    borderBottomColor: theme.colors.success,
  },

  title: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    textAlign: 'center',
  },

  description: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.xs,
    marginTop: 2,
    textAlign: 'center',
  },
});
