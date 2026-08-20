import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Searchbar, Avatar, Badge, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useTabBarHeight } from '../../../../src/hooks/useTabBarHeight';
import { useAuth } from '../../../../src/hooks/useAuth';
import { useTutees } from '../../../../src/hooks/useTutees';
import { chatService } from '../../../../src/services/chatService';
import { ChatThread } from '../../../../src/types/chat';
import { Tutee } from '../../../../src/types/tutee';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../src/services/firebaseConfig';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import Animated, { FadeInDown } from 'react-native-reanimated';

const ThreadListItem = React.memo(function ThreadListItem({
  item,
  index,
  partnerName,
  unreadCount,
  photoUrl,
  onPress,
}: {
  item: ChatThread;
  index: number;
  partnerName: string;
  unreadCount: number;
  photoUrl: string | undefined;
  onPress: () => void;
}) {
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 40).duration(200)}>
      <TouchableOpacity style={styles.threadItem} onPress={onPress}>
        {photoUrl ? (
          <Avatar.Image
            size={scale(48)}
            source={{ uri: photoUrl }}
            style={styles.avatar}
          />
        ) : (
          <Avatar.Text
            size={scale(48)}
            label={getInitials(partnerName)}
            style={styles.avatar}
            labelStyle={styles.avatarLabel}
          />
        )}
        <View style={styles.threadContent}>
          <View style={styles.threadHeader}>
            <Text style={styles.partnerName} numberOfLines={1}>
              {partnerName}
            </Text>
            {item.lastMessageTimestamp && (
              <Text style={styles.timestamp}>
                {formatTimestamp(item.lastMessageTimestamp)}
              </Text>
            )}
          </View>
          <Text style={styles.studentLabel} numberOfLines={1}>
            re: {item.tuteeName}
          </Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessageText || 'No messages yet'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <Badge style={styles.badge}>{unreadCount}</Badge>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function ChatThreadListScreen() {
  const { user } = useAuth();
  const { tutees } = useTutees();
  const tabBarHeight = useTabBarHeight();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingThread, setCreatingThread] = useState<string | null>(null);

  const subscribeToThreads = useCallback(() => {
    if (!user) return;

    const unsubscribe = chatService.subscribeToThreads(
      user.id,
      user.role,
      (updatedThreads) => {
        setThreads(updatedThreads);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error('Thread subscription error:', error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsubscribe;
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = subscribeToThreads();
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }, [subscribeToThreads])
  );

  const [tuteePhotos, setTuteePhotos] = useState<Record<string, string>>({});
  const fetchedPhotosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || threads.length === 0) return;

    const fetchTuteePhotos = async () => {
      const newPhotos: Record<string, string> = {};
      let changed = false;

      const unfetchedThreads = threads.filter((thread) => {
        if (!thread.tuteeId || !thread.tutorId) return false;
        if (fetchedPhotosRef.current.has(thread.tuteeId)) return false;
        return true;
      });

      if (unfetchedThreads.length === 0) return;

      await Promise.all(
        unfetchedThreads.map(async (thread) => {
          try {
            const tuteeDoc = await getDoc(
              doc(db, 'users', thread.tutorId, 'tutees', thread.tuteeId)
            );
            if (tuteeDoc.exists()) {
              newPhotos[thread.tuteeId] = tuteeDoc.data()?.photoUrl || '';
            } else {
              newPhotos[thread.tuteeId] = '';
            }
            fetchedPhotosRef.current.add(thread.tuteeId);
            changed = true;
          } catch (error) {
            console.error('Error fetching tutee photo:', error);
            fetchedPhotosRef.current.add(thread.tuteeId);
          }
        })
      );

      if (changed) {
        setTuteePhotos((prev) => ({ ...prev, ...newPhotos }));
      }
    };

    fetchTuteePhotos();
  }, [threads, user]);

  const getPartnerName = useCallback(
    (thread: ChatThread): string => {
      if (user?.role === 'parent') {
        return thread.tutorName || 'Tutor';
      }
      return thread.parentName || 'Parent';
    },
    [user?.role]
  );

  const handleCreateThread = useCallback(
    async (tutee: Tutee) => {
      if (!user) return;
      setCreatingThread(tutee.id);
      try {
        const parentId = tutee.parentId || user.id;
        const tutorId = user.role === 'tutor' ? user.id : user.createdByTutorId || '';
        const thread = await chatService.getOrCreateThread(tutee, parentId, tutorId);
        router.navigate(`/(main)/chat/${thread.id}`);
      } catch (error) {
        console.error('Failed to create thread:', error);
      } finally {
        setCreatingThread(null);
      }
    },
    [user]
  );

  const filteredThreads = useMemo(() => {
    if (!searchQuery) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter((thread) => {
      const partnerName = getPartnerName(thread).toLowerCase();
      const studentName = (thread.tuteeName || '').toLowerCase();
      return partnerName.includes(q) || studentName.includes(q);
    });
  }, [threads, searchQuery, getPartnerName]);

  const tuteesWithoutThread = useMemo(() => {
    return tutees.filter((tutee) => !threads.some((t) => t.tuteeId === tutee.id));
  }, [tutees, threads]);

  const filteredTuteesWithoutThread = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return tuteesWithoutThread.filter((tutee) => {
      const fullName = `${tutee.firstName} ${tutee.surname}`.toLowerCase();
      return fullName.includes(q);
    });
  }, [tuteesWithoutThread, searchQuery]);

  const renderThreadItem = useCallback(
    ({ item, index }: { item: ChatThread; index: number }) => {
      const partnerName = getPartnerName(item);
      const unreadCount = item.unreadCount?.[user?.id || ''] || 0;
      const photoUrl = tuteePhotos[item.tuteeId];

      return (
        <ThreadListItem
          item={item}
          index={index}
          partnerName={partnerName}
          unreadCount={unreadCount}
          photoUrl={photoUrl}
          onPress={() => router.navigate(`/(main)/chat/${item.id}`)}
        />
      );
    },
    [getPartnerName, user?.id, tuteePhotos]
  );

  const renderTuteeItem = useCallback(
    ({ item }: { item: Tutee }) => {
      const isCreating = creatingThread === item.id;
      const fullName = `${item.firstName} ${item.surname}`;

      const getInitials = (name: string): string => {
        return name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
      };

      return (
        <TouchableOpacity
          style={styles.threadItem}
          onPress={() => handleCreateThread(item)}
          disabled={isCreating}
        >
          {item.photoUrl ? (
            <Avatar.Image
              size={scale(48)}
              source={{ uri: item.photoUrl }}
              style={styles.avatar}
            />
          ) : (
            <Avatar.Text
              size={scale(48)}
              label={getInitials(fullName)}
              style={styles.avatar}
              labelStyle={styles.avatarLabel}
            />
          )}
          <View style={styles.threadContent}>
            <View style={styles.threadHeader}>
              <Text style={styles.partnerName} numberOfLines={1}>
                {fullName}
              </Text>
              {isCreating ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <MaterialCommunityIcons name="chat-plus-outline" size={scale(20)} color="#2563eb" />
              )}
            </View>
            <Text style={styles.newThreadSubtitle}>Click to start chat</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [creatingThread, handleCreateThread]
  );

  const ListHeader = useCallback(() => {
    if (filteredTuteesWithoutThread.length === 0) return null;
    return (
      <View>
        <Text style={styles.sectionHeader}>Start a new conversation</Text>
        {filteredTuteesWithoutThread.map((tutee, index) => (
          <Animated.View key={tutee.id} entering={FadeInDown.delay(index * 40).duration(200)}>
            {renderTuteeItem({ item: tutee })}
          </Animated.View>
        ))}
      </View>
    );
  }, [filteredTuteesWithoutThread, renderTuteeItem]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Messages',
          headerTintColor: '#2563eb',
          headerStyle: { backgroundColor: '#eff6ff' },
        }}
      />
      <View style={styles.container}>
        <Searchbar
          placeholder="Search messages or student..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchbarInput}
        />
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading chats...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredThreads}
            keyExtractor={(item) => item.id}
            renderItem={renderThreadItem}
            contentContainerStyle={{ paddingBottom: tabBarHeight }}
            ListHeaderComponent={ListHeader}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  subscribeToThreads();
                }}
                colors={['#2563eb']}
                tintColor="#2563eb"
              />
            }
            ListEmptyComponent={
              <View style={styles.centered}>
                <MaterialCommunityIcons name="chat-outline" size={scale(56)} color="#d1d5db" />
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtitle}>
                  {user?.role === 'parent'
                    ? 'Your tutor will appear here once linked.'
                    : 'Link parent accounts to start chatting.'}
                </Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff6ff',
  },
  searchbar: {
    margin: scale(12),
    borderRadius: scale(12),
    elevation: 0,
    backgroundColor: '#ffffff',
  },
  searchbarInput: {
    fontSize: moderateScale(15),
  },
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),
  },
  avatar: {
    backgroundColor: '#2563eb',
  },
  avatarLabel: {
    color: '#ffffff',
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  threadContent: {
    flex: 1,
    marginLeft: scale(12),
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerName: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  timestamp: {
    fontSize: moderateScale(12),
    color: '#9ca3af',
    marginLeft: scale(8),
  },
  studentLabel: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: '#2563eb',
    textTransform: 'uppercase',
    marginTop: verticalScale(2),
  },
  lastMessage: {
    fontSize: moderateScale(13),
    color: '#6b7280',
    marginTop: verticalScale(2),
  },
  badge: {
    backgroundColor: '#2563eb',
    marginLeft: scale(8),
    alignSelf: 'center',
  },
  sectionHeader: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(6),
  },
  newThreadSubtitle: {
    fontSize: moderateScale(12),
    color: '#2563eb',
    marginTop: verticalScale(2),
  },
  separator: {
    height: verticalScale(1),
    backgroundColor: '#f3f4f6',
    marginLeft: scale(76),
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(32),
  },
  loadingText: {
    fontSize: moderateScale(14),
    color: '#6b7280',
    marginTop: verticalScale(12),
  },
  emptyTitle: {
    fontSize: moderateScale(17),
    fontWeight: '700',
    color: '#374151',
    marginTop: verticalScale(14),
  },
  emptySubtitle: {
    fontSize: moderateScale(13),
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: verticalScale(6),
    lineHeight: verticalScale(18),
  },
});
