import React from 'react';
import { TouchableOpacity, Text, StyleSheet, GestureResponderEvent,ViewStyle  } from 'react-native';
import theme from '../constants/theme';

interface Props {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  color?: string; // ??
  style?: ViewStyle;
}

const Button = ({ title, onPress, color, style }: Props) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, { backgroundColor: color || theme.colors.primary }, style]}
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  text: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default Button;
