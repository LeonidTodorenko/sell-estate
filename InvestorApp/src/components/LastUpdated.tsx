import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import theme from '../constants/theme';

type Props = {
  timestamp: number;
  style?: TextStyle;
};

export default function LastUpdated({ timestamp, style }: Props) {
  if (!timestamp) return null;

  const value = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return <Text style={[styles.text, style]}>Updated {value}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
});
