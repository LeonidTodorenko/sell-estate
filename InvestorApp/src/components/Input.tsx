import React from 'react';
import { TextInput, StyleSheet, TextInputProps } from 'react-native';


const Input = (props: TextInputProps) => {
  return (
    <TextInput
      style={styles.input}
      placeholderTextColor="#999"
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
});

export default Input;
