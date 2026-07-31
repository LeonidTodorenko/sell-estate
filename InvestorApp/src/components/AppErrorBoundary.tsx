import React, { ErrorInfo, ReactNode } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import theme from '../constants/theme';
import BlueButton from './BlueButton';

type AppErrorBoundaryProps = {
  children: ReactNode;
  onRestart?: () => void;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
};

/**
 * Глобальный React Error Boundary.
 *
 * Ловит ошибки, возникшие:
 * - во время render;
 * - в constructor дочерних компонентов;
 * - в lifecycle-методах дочерних компонентов.
 *
 * Не ловит ошибки внутри:
 * - обработчиков нажатий;
 * - setTimeout / Promise без await/catch;
 * - нативного кода;
 * - самого ErrorBoundary.
 */
class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    error: null,
    componentStack: '',
  };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const componentStack = info.componentStack ?? '';

    this.setState({ componentStack });

    console.error('[AppErrorBoundary] Unhandled React error:', error);
    console.error('[AppErrorBoundary] Component stack:', componentStack);

    // Позже сюда можно добавить Crashlytics или Sentry:
    // crashlytics().recordError(error);
    // Sentry.captureException(error);
  }

  private handleRestart = () => {
    try {
      this.props.onRestart?.();
    } catch (restartError) {
      console.error(
        '[AppErrorBoundary] Failed to run restart callback:',
        restartError,
      );
    }

    // Сбрасываем fallback и повторно монтируем дерево приложения.
    this.setState({
      hasError: false,
      error: null,
      componentStack: '',
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const errorMessage =
      this.state.error?.message || 'An unexpected application error occurred.';

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>!</Text>
            </View>

            <Text style={styles.title}>Something went wrong</Text>

            <Text style={styles.description}>
              The application encountered an unexpected error. Restart the app
              screen and try again.
            </Text>

            <BlueButton
              title="Restart app"
              onPress={this.handleRestart}
              width="full"
              style={styles.restartButton}
            />

            {__DEV__ && (
              <View style={styles.details}>
                <Text style={styles.detailsTitle}>Development details</Text>

                <Text selectable style={styles.errorText}>
                  {errorMessage}
                </Text>

                {!!this.state.componentStack && (
                  <Text selectable style={styles.stackText}>
                    {this.state.componentStack}
                  </Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },

  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.xl,
  },

  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.disabledBg,
  },

  icon: {
    color: theme.colors.danger,
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 40,
  },

  title: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    textAlign: 'center',
  },

  description: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.md,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },

  restartButton: {
    marginTop: theme.spacing.lg,
    marginBottom: 0,
  },

  details: {
    width: '100%',
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },

  detailsTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },

  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
  },

  stackText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    lineHeight: 18,
    marginTop: theme.spacing.sm,
  },
});

export default AppErrorBoundary;
