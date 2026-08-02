import React from 'react';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../../src/components/FloatingTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="my-children" />
      <Tabs.Screen name="announcements" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
