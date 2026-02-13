import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

type InvestButtonProps = {
  title: string;
  onPress: () => void;
  style?: any;
  disabled?: boolean;
  width?: number | string | 'full';
};

const InvestButton: React.FC<InvestButtonProps> = ({
  title,
  onPress,
  style,
  disabled = false,
  width,
}) => {
  let resolvedWidth: number | string | undefined;
  if (width === 'full') {
    resolvedWidth = '100%';
  } else if (typeof width === 'number' || typeof width === 'string') {
    resolvedWidth = width;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={[
        {
          backgroundColor: '#1e90ff',
          paddingVertical: 14,
          paddingHorizontal: 16,
          marginBottom: 10,
          borderRadius: 10,

          // центрируем контент
          alignItems: 'center',
          justifyContent: 'center',

          // тень / 3D
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,

          width: resolvedWidth,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: '#000',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

export default InvestButton;
