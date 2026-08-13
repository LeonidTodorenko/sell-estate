import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import theme from '../constants/theme';

type Props = {
  isDemo?: boolean;
  demoCode?: string | null;
  compact?: boolean;
};

export default function DemoModeBanner({ isDemo, demoCode, compact = false }: Props) {
  if (!isDemo) return null;

  return (
    <View style={[styles.banner, compact && styles.compact]} accessibilityRole="text">
      <Ionicons name="flask-outline" size={compact ? 16 : 20} color="#047857" />
      <View style={styles.copy}>
        <Text style={styles.title}>Demo Mode</Text>
        {!compact && (
          <Text style={styles.description}>Virtual funds and simulated transactions</Text>
        )}
      </View>
      {!!demoCode && <Text style={styles.code}>{demoCode}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compact: { marginHorizontal: 0, marginTop: 0, paddingVertical: 9 },
  copy: { flex: 1 },
  title: { color: '#065F46', fontSize: 15, fontWeight: '700' },
  description: { color: '#047857', fontSize: 12, marginTop: 2 },
  code: { color: '#047857', fontSize: 11, fontWeight: '700' },
});
