import React, { useEffect } from 'react';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuthContext } from '../src/contexts/AuthContext';
import { NotificationProvider } from '../src/contexts/NotificationContext';
import { ActivityIndicator, View, StyleSheet, Text, TextInput } from 'react-native';
import { PaperProvider, DefaultTheme } from 'react-native-paper';

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

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      if (user.mustChangePassword) {
        router.replace('/(auth)/change-password');
      } else {
        router.replace('/(main)');
      }
    }
  }, [user, segments, isLoading]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(main)" />
      </Stack>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      )}
    </>
  );
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={stripLetterSpacing(theme)}>
        <SafeAreaProvider>
          <AuthProvider>
            <NotificationProvider>
              <RootLayoutNav />
              <StatusBar style="dark" />
            </NotificationProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
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
