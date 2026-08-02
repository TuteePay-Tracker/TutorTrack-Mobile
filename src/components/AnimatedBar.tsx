import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';

interface AnimatedBarProps {
  axis?: 'vertical' | 'horizontal';
  height?: number;
  width?: number | `${number}%`;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
}

export const AnimatedBar = ({
  axis = 'vertical',
  height,
  width,
  delay = 0,
  style,
  backgroundColor,
}: AnimatedBarProps) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, { damping: 18, stiffness: 120 }));
  }, [delay]);

  const verticalStyle = useAnimatedStyle(() => ({
    height: (height || 0) * progress.value,
  }));

  const horizontalStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  if (axis === 'horizontal') {
    return (
      <Animated.View
        style={[style, { backgroundColor, width, transformOrigin: 'left' }, horizontalStyle]}
      />
    );
  }

  return <Animated.View style={[style, { backgroundColor }, verticalStyle]} />;
};
