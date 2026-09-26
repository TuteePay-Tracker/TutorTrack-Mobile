import React, { useEffect, useState } from 'react';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuthContext } from '../src/contexts/AuthContext';
import { NotificationProvider } from '../src/contexts/NotificationContext';
import { SchoolYearProvider } from '../src/contexts/SchoolYearContext';
import { ActivityIndicator, View, StyleSheet, Text, TextInput } from 'react-native';
import { PaperProvider, DefaultTheme } from 'react-native-paper';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import AnimatedSplash from '../src/components/AnimatedSplash';

// Keep the native splash screen visible until the auth guard has settled on the
// correct route, so an unauthenticated cold start never flashes the dashboard.
SplashScreen.preventAutoHideAsync().catch(() => {});

(Text as any).defaultProps = {
  ...(Text as any).defaultProps,
  letterSpacing: undefined,
};

(TextInput as any).defaultProps = {
  ...(TextInput as any).defaultProps,
  letterSpacing: undefined,
};

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2563eb',
    primaryContainer: '#dbeafe',
    secondary: '#059669',
    surface: '#ffffff',
    surfaceVariant: '#ffffff',
    elevation: {
      level0: 'transparent',
      level1: '#ffffff',
      level2: '#ffffff',
      level3: '#ffffff',
      level4: '#ffffff',
      level5: '#ffffff',
    },
    background: '#f9fafb',
  },
};

function stripLetterSpacing(t: typeof DefaultTheme) {
  const fonts = { ...t.fonts } as Record<string, any>;
  for (const key of Object.keys(fonts)) {
    if (typeof fonts[key] === 'object' && fonts[key] !== null && 'letterSpacing' in fonts[key]) {
      const { letterSpacing, ...rest } = fonts[key];
      fonts[key] = rest;
    }
  }
  return { ...t, fonts } as typeof DefaultTheme;
}

function RootLayoutNav() {
  const { user, isLoading } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();
  const [settled, setSettled] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const stackOpacity = useSharedValue(0);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      setSettled(false);
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      setSettled(false);
      if (user.mustChangePassword) {
        router.replace('/(auth)/change-password');
      } else {
        router.replace('/(main)');
      }
    } else {
      setSettled(true);
    }
  }, [user, segments, isLoading]);

  useEffect(() => {
    if (isLoading || !settled) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [isLoading, settled]);

  const handleSplashFinish = () => {
    setShowSplash(false);
    stackOpacity.value = withTiming(1, {
      duration: 600,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  };

  const stackAnimatedStyle = useAnimatedStyle(() => ({
    opacity: stackOpacity.value,
  }));

  return (
    <View style={styles.rootContainer}>
      <Animated.View style={[{ flex: 1 }, stackAnimatedStyle]}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(main)" />
        </Stack>
      </Animated.View>
      {(isLoading || !settled) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      )}
      {showSplash && (
        <AnimatedSplash onFinish={handleSplashFinish} />
      )}
    </View>
  );
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={stripLetterSpacing(theme)}>
        <SafeAreaProvider>
          <AuthProvider>
            <SchoolYearProvider>
              <NotificationProvider>
                <RootLayoutNav />
                <StatusBar style="dark" />
              </NotificationProvider>
            </SchoolYearProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#eff6ff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    zIndex: 999,
  },
});
