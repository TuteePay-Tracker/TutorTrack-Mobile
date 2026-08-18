import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale } from 'react-native-size-matters';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';

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

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

function TabButton({ icon, focused, showBadge, onPress }: { icon: string; focused: boolean; showBadge?: boolean; onPress: () => void }) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, { damping: 16, stiffness: 220 });
  }, [focused, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.08]) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 1.15]) },
      { translateY: interpolate(progress.value, [0, 1], [0, -1]) },
    ],
  }));

  return (
    <AnimatedTouchableOpacity
      style={[styles.tab, focused && styles.activeTab, pillStyle]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.View style={iconStyle}>
        <MaterialCommunityIcons
          name={icon as any}
          size={scale(20)}
          color={focused ? '#ffffff' : '#9ca3af'}
        />
        {showBadge && <View style={styles.badgeDot} />}
      </Animated.View>
    </AnimatedTouchableOpacity>
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

    const unsubscribe = chatService.subscribeToThreads(
      user.id,
      user.role,
      (threads) => {
        const hasAnyUnread = threads.some((thread) => {
          const count = thread.unreadCount?.[user.id] || 0;
          return count > 0;
        });
        setHasUnreadChats(hasAnyUnread);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const focusedRoute = state.routes[state.index];
  if (!focusedRoute) return null;
  if (!tabs.some((t) => t.key === focusedRoute.name)) {
    return null;
  }
  if (focusedRoute.state?.index > 0) {
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
              focused={isFocused}
              showBadge={tab.key === 'chat' && hasUnreadChats}
              onPress={() => {
                if (!isFocused) {
                  const routeName = state.routes[tabIndex].name;
                  if (routeName === 'chat') {
                    navigation.navigate('chat', { screen: 'index' });
                  } else if (routeName === 'announcements') {
                    navigation.navigate('announcements', { screen: 'index' });
                  } else {
                    navigation.navigate(routeName);
                  }
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
    left: scale(16),
    right: scale(16),
    alignItems: 'center',
    zIndex: 100,
    elevation: 10,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: scale(28),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(8),
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
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(14),
    borderRadius: scale(20),
    minWidth: scale(48),
  },
  activeTab: {
    backgroundColor: '#2563eb',
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
