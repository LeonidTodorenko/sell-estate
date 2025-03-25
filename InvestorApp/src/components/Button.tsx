import React from 'react';
import { TouchableOpacity, Text, StyleSheet, GestureResponderEvent } from 'react-native';

interface Props {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
}

const Button = ({ title, onPress }: Props) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.button}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default Button;
