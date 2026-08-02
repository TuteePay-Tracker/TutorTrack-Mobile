import React from 'react';
import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="children/[id]" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="payment-proof" />
      <Stack.Screen name="assessments" />
      <Stack.Screen name="attendance" />
    </Stack>
  );
}
