import React, { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

type Props = {
  onFinish: () => void;
};

const BLUE = "#2563EB";
const LIGHT_BLUE = "#EFF6FF";

// Sequence:
// Page 1 → 2: delay 200ms, animate 1250ms
// Page 2 → 3: animate 625ms
// Page 3 → 4: delay 200ms, animate 1250ms
const EXPAND_START = 200;
const CONTENT_START = EXPAND_START + 1250;
const COLLAPSE_START = CONTENT_START + 625 + 200;
const FINISH_TIME = COLLAPSE_START + 1250;

export default function AnimatedSplash({ onFinish }: Props) {
  const circleScale = useSharedValue(1);
  const contentOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.85);

  const slowEasing = Easing.bezier(0.4, 0, 0.2, 1);

  useEffect(() => {
    // Page 1 → Page 2: 20px dot expands over the screen.
    circleScale.value = withDelay(
      EXPAND_START,
      withTiming(60, {
        duration: 1250,
        easing: slowEasing,
      })
    );

    // Page 2 → Page 3: logo and title appear.
    contentOpacity.value = withDelay(
      CONTENT_START,
      withTiming(1, {
        duration: 625,
        easing: slowEasing,
      })
    );

    contentScale.value = withDelay(
      CONTENT_START,
      withTiming(1, {
        duration: 625,
        easing: slowEasing,
      })
    );

    // Page 3 → Page 4: hide content and collapse blue circle.
    circleScale.value = withDelay(
      COLLAPSE_START,
      withTiming(0.05, {
        duration: 1250,
        easing: slowEasing,
      })
    );

    contentOpacity.value = withDelay(
      COLLAPSE_START,
      withTiming(0, {
        duration: 450,
        easing: slowEasing,
      })
    );

    const timer = setTimeout(() => {
      runOnJS(onFinish)();
    }, FINISH_TIME);

    return () => clearTimeout(timer);
  }, []);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Page 1: small blue dot */}
      <Animated.View style={[styles.circle, circleStyle]} />

      {/* Page 3 */}
      <Animated.View style={[styles.content, contentStyle]}>
        <Image
          source={require("../../assets/splash-icon.png")}
          style={styles.logo}
        />

        <Text style={styles.title}>Tutor Track</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LIGHT_BLUE,
  },

  circle: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BLUE,
  },

  content: {
    alignItems: "center",
  },

  logo: {
    width: 141,
    height: 141,
    borderRadius: 20,
    overflow: "hidden",
    resizeMode: "contain",
  },

  title: {
    marginTop: 12,
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
});
