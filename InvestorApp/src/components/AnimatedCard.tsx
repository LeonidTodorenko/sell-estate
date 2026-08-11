import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

type AnimatedCardProps = {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

export default function AnimatedCard({
  children,
  delay = 0,
  style,
}: AnimatedCardProps) {
  return (
    <Animated.View
      entering={FadeInUp
        .duration(400)
        .delay(delay)
        .springify()
        .damping(18)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}