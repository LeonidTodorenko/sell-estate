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
       showArrow?: boolean;
};

const BlueButton: React.FC<BlueButtonProps> = ({ title, onPress, icon, variant='primary', style,disabled = false,width,additionalPadding,showArrow = true }) => {
  const bgColors = {
    primary: 'white',
    red: '#d9534f',
    green: '#28a745',
    gray: '#6c757d',
    orange: 'orange',
  };

    const bg = disabled ? '#cccccc' : bgColors[variant];
  //const textColor = disabled ? 'black' : 'black';

    let resolvedWidth: number | string | undefined;
  if (width === 'full') {
    resolvedWidth = '100%';
  } else if (typeof width === 'number' || typeof width === 'string') {
    resolvedWidth = width;
  }

    const resolvedReservedLeft = additionalPadding ?? RESERVED_LEFT;

  return (
     <TouchableOpacity
      activeOpacity={0.85} //  activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={[
        {
          backgroundColor: bg,
          paddingVertical: 14,
          paddingHorizontal: 16,
          marginBottom: 10,
          borderRadius: 10,
          paddingLeft: resolvedReservedLeft,
          paddingRight: resolvedReservedLeft,
          // 3D эффект
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Текст слева */}
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: '#2a1602',
          }}
        >
          {title}
             {/* {icon} todo убрали иконку пока */}
        </Text>

        {/* Стрелка справа */}
        {showArrow && (
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: '#2a1602',
              marginLeft: 8,
            }}
          >
            ›
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default BlueButton;

