import React from 'react';
import { TouchableOpacity, Text, View   } from 'react-native';

const ICON_SIZE = 18;
const ICON_LEFT_PADDING = 16;
const RESERVED_LEFT = ICON_LEFT_PADDING + ICON_SIZE + 8;

type BlueButtonProps = {
  title: string;
  onPress: () => void;
  icon?: string;
  variant?: 'primary'|'red'|'green'|'gray'|'orange';
  style?: any;
   disabled?: boolean;
     width?: number | string | 'full';
     additionalPadding?: number; 
};

const BlueButton: React.FC<BlueButtonProps> = ({ title, onPress, icon, variant='primary', style,disabled = false,width,additionalPadding }) => {
  const bgColors = {
    primary: '#1e90ff',
    red: '#d9534f',
    green: '#28a745',
    gray: '#6c757d',
    orange: 'orange',
  };

    const bg = disabled ? '#cccccc' : bgColors[variant];
  const textColor = disabled ? '#666666' : '#f4f4f4';

    let resolvedWidth: number | string | undefined;
  if (width === 'full') {
    resolvedWidth = '100%';
  } else if (typeof width === 'number' || typeof width === 'string') {
    resolvedWidth = width;
  }

    const resolvedReservedLeft = additionalPadding ?? RESERVED_LEFT;

  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.85}
      onPress={disabled ? undefined : onPress}
      style={[
        {
          backgroundColor: bg,
          paddingVertical: 9,
           paddingHorizontal: 16,
          marginBottom: 8,
              paddingLeft: resolvedReservedLeft,
    paddingRight: resolvedReservedLeft,
          // paddingLeft: icon ? RESERVED_LEFT : 16,
          // paddingRight: icon ? RESERVED_LEFT : 16,
          elevation: 2,
          opacity: disabled ? 0.7 : 1,
            width: resolvedWidth,
        },
        style,
      ]}
       disabled={disabled}
    >
      {icon ? (
        <Text
          style={{
            position: 'absolute',
            left: ICON_LEFT_PADDING,
            top: '80%',
            transform: [{ translateY: -ICON_SIZE / 2 }],
            fontSize: ICON_SIZE,
          }}
        >
          {icon}
        </Text>
      ) : null}

      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: textColor, fontWeight: 'bold', letterSpacing: 0.5 }}>
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default BlueButton;

