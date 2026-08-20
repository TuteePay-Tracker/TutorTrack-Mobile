import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale } from 'react-native-size-matters';

interface TabDef {
  key: string;
  label: string;
  icon: string;
}

const tabs: TabDef[] = [
  { key: 'index', label: 'Home', icon: 'home' },
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

function TabButton({ icon, label, focused, showBadge, onPress }: { icon: string; label: string; focused: boolean; showBadge?: boolean; onPress: () => void }) {
  const iconName = focused ? icon : `${icon}-outline`;

  return (
    <TouchableOpacity
      style={[styles.tab, focused && styles.activeTab]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ alignItems: 'center' }}>
        <View style={{ position: 'relative' }}>
          <MaterialCommunityIcons
            name={iconName as any}
            size={scale(18)}
            color={focused ? '#ffffff' : '#9ca3af'}
          />
          {showBadge && <View style={styles.badgeDot} />}
        </View>
        <Text style={[styles.labelText, { color: focused ? '#ffffff' : '#9ca3af' }]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function FloatingTabBar({ state, navigation }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [hasUnreadChats, setHasUnreadChats] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasUnreadChats(false);
      return;
    }

    const unsubscribe = chatService.subscribeToUnreadStatus(
      user.id,
      user.role,
      (hasUnread) => {
        setHasUnreadChats(hasUnread);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const focusedRoute = state.routes[state.index];
  if (!focusedRoute) return null;

  // Hide the tab bar if we are not on a recognised top-level tab.
  if (!tabs.some((t) => t.key === focusedRoute.name)) {
    return null;
  }

  // Hide when a nested stack screen is active.
  // focusedRoute.state is populated for normal in-app pushes;
  // when the screen was reached via a cold-start deep-link the state is
  // undefined but the nested route name is non-null – check both.
  const nestedIndex = focusedRoute.state?.index ?? 0;
  const nestedRouteName = focusedRoute.state?.routes?.[nestedIndex]?.name ?? '';
  const isShowingDetail =
    nestedIndex > 0 ||
    nestedRouteName === '[id]' ||
    nestedRouteName.startsWith('[');
  if (isShowingDetail) {
    return null;
  }

  return (
    <View
      style={[styles.wrapper, { bottom: insets.bottom + verticalScale(8) }]}
    >
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const tabIndex = state.routes.findIndex((r: any) => r.name === tab.key);
          if (tabIndex === -1) return null;
          const isFocused = state.index === tabIndex;

          return (
            <TabButton
              key={tab.key}
              icon={tab.icon}
              label={tab.label}
              focused={isFocused}
              showBadge={tab.key === 'chat' && hasUnreadChats}
              onPress={() => {
                const routeName = state.routes[tabIndex].name;
                if (routeName === 'chat') {
                  // Always target the index so that re-tapping resets a stuck stack.
                  navigation.navigate('chat', { screen: 'index' });
                } else if (routeName === 'announcements') {
                  navigation.navigate('announcements', { screen: 'index' });
                } else if (!isFocused) {
                  navigation.navigate(routeName);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: scale(10),
    right: scale(10),
    alignItems: 'center',
    zIndex: 100,
    elevation: 10,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#ffffffee',
    borderRadius: scale(28),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(8),
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(4),
    paddingHorizontal: scale(12),
    borderRadius: scale(24),
    minWidth: scale(56),
  },
  activeTab: {
    backgroundColor: '#2563eb',
  },
  labelText: {
    fontSize: scale(8),
    marginTop: verticalScale(2),
    fontWeight: '500',
  },
  badgeDot: {
    position: 'absolute',
    top: -scale(2),
    right: -scale(2),
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
});
