import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';

interface ScaleOnPressProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  entering?: any;
  layout?: any;
  disabled?: boolean;
}

export const ScaleOnPress = ({ children, onPress, style, entering, layout, disabled }: ScaleOnPressProps) => {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.98]) }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]} entering={entering} layout={layout}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          pressed.value = withSpring(1, { damping: 20, stiffness: 300 });
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, { damping: 20, stiffness: 300 });
        }}
        disabled={disabled}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};
