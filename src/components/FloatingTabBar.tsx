import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TabDef {
  key: string;
  label: string;
  icon: string;
}

const tabs: TabDef[] = [
  { key: 'index', label: 'Home', icon: 'view-dashboard' },
  { key: 'my-children', label: 'Children', icon: 'account-group' },
  { key: 'announcements', label: 'Alerts', icon: 'bullhorn' },
  { key: 'chat', label: 'Chat', icon: 'message-text' },
  { key: 'settings', label: 'Settings', icon: 'cog' },
];

interface FloatingTabBarProps {
  state: any;
  navigation: any;
  descriptors: any;
}

export function FloatingTabBar({ state, navigation }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();

  const focusedRoute = state.routes[state.index];
  if (focusedRoute?.name === 'chat' && focusedRoute?.state?.index > 0) {
    return null;
  }
  if (focusedRoute?.name === 'announcements' && focusedRoute?.state?.index > 0) {
    return null;
  }

  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 8 }]}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const tabIndex = state.routes.findIndex((r: any) => r.name === tab.key);
          if (tabIndex === -1) return null;
          const isFocused = state.index === tabIndex;

          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isFocused && styles.activeTab]}
              onPress={() => {
                if (!isFocused) {
                  navigation.navigate(state.routes[tabIndex].name);
                }
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={20}
                color={isFocused ? '#ffffff' : '#9ca3af'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 100,
    elevation: 10,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    minWidth: 48,
  },
  activeTab: {
    backgroundColor: '#15803d',
  },
});
