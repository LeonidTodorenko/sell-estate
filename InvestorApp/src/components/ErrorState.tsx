import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import theme from '../constants/theme';

type ErrorStateProps = {
  title?: string;
  description?: string;
  retryTitle?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function ErrorState({
  title = 'Unable to load data',
  description = 'Please check your connection and try again.',
  retryTitle = 'Try again',
  onRetry,
  isRetrying = false,
  style,
}: ErrorStateProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>!</Text>
      </View>

      <Text style={styles.title}>{title}</Text>

      {!!description && (
        <Text style={styles.description}>{description}</Text>
      )}

      {!!onRetry && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={retryTitle}
          disabled={isRetrying}
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && !isRetrying && styles.retryButtonPressed,
            isRetrying && styles.retryButtonDisabled,
          ]}
        >
          <Text style={styles.retryButtonText}>
            {isRetrying ? 'Loading...' : retryTitle}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 260,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEECEC',
    marginBottom: theme.spacing.md,
  },
  icon: {
    fontSize: 28,
    lineHeight: 31,
    fontWeight: '800',
    color: theme.colors.danger,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
  },
  description: {
    marginTop: theme.spacing.sm,
    maxWidth: 310,
    fontSize: theme.typography.sizes.sm,
    lineHeight: 20,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    minWidth: 132,
    height: 46,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  retryButtonPressed: {
    opacity: 0.82,
  },
  retryButtonDisabled: {
    opacity: 0.55,
  },
  retryButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.white,
  },
});
