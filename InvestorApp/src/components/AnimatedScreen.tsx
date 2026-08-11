import React from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';

type Props = {
  children: React.ReactNode;
  delay?: number;
};

export default function AnimatedScreen({
  children,
  delay = 0,
}: Props) {
  return (
    <Animated.View
      entering={FadeInUp
        .duration(350)
        .delay(delay)}
      style={{ flex: 1 }}
    >
      {children}
    </Animated.View>
  );
}