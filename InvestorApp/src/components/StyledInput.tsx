 
import React from 'react';
import { TextInput, TextInputProps } from 'react-native';

const StyledInput = (props: TextInputProps) => {
  return (
    <TextInput
      {...props}
      placeholderTextColor="gray"
      style={[{ color: '#000' }, props.style]}
    />
  );
};

export default StyledInput;
