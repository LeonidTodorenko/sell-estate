import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import theme from '../constants/theme';

type BlueButtonProps = {
  title: string;
  onPress: () => void;
  icon?: string;
  iconSource?: ImageSourcePropType;
  variant?: 'primary' | 'red' | 'green' | 'gray' | 'orange';
  style?: any;
  disabled?: boolean;
  width?: number | string | 'full';
  additionalPadding?: number;
  showArrow?: boolean;

  bgColor?: string;
  textColor?: string;
  borderColor?: string;
  paddingVertical?: number;
  paddingHorizontal?: number;
  iconSize?: number;
};

const BlueButton: React.FC<BlueButtonProps> = ({
  title,
  onPress,
  iconSource,
  variant = 'primary',
  style,
  disabled = false,
  width,
  showArrow = false,
  bgColor,
  textColor,
  borderColor,
  paddingVertical = 10,
  paddingHorizontal = 24,
  iconSize = 18,
}) => {
  let resolvedWidth: number | string | undefined;
  if (width === 'full') resolvedWidth = '100%';
  else if (typeof width === 'number' || typeof width === 'string') resolvedWidth = width;

  const variantBgMap: Record<NonNullable<BlueButtonProps['variant']>, string> = {
    primary: theme.colors.primary,
    green: theme.colors.success,
    red: theme.colors.danger,
    orange: theme.colors.warning,
    gray: theme.colors.surface,
  };

  const resolvedBackgroundColor =
    bgColor ?? (disabled ? theme.colors.disabledBg : variantBgMap[variant]);

  const isLight =
    resolvedBackgroundColor === theme.colors.surface ||
    resolvedBackgroundColor === '#FFFFFF' ||
    variant === 'gray';

  const resolvedTextColor =
    textColor ??
    (disabled
      ? theme.colors.disabledText
      : isLight
        ? theme.colors.text
        : theme.colors.white);

  const resolvedBorderColor =
    borderColor ?? (isLight ? theme.colors.border : 'transparent');

  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={[
        styles.btn,
        {
          backgroundColor: resolvedBackgroundColor,
          borderColor: resolvedBorderColor,
          width: resolvedWidth,
          opacity: disabled ? 0.75 : 1,
          paddingVertical,
          paddingHorizontal,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.content}>
          {!!iconSource && (
            <Image
              source={iconSource}
              style={{ width: iconSize, height: iconSize, marginRight: 8 }}
              resizeMode="contain"
            />
          )}

          <Text style={[styles.title, { color: resolvedTextColor }]}>
            {title}
          </Text>
        </View>

        {showArrow && (
          <Text style={[styles.arrow, { color: resolvedTextColor }]}>›</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    marginBottom: 10,
    borderRadius: theme.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '500',
  },

  arrow: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default BlueButton;