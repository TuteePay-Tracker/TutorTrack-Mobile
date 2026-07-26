import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Text, Searchbar, Avatar, Badge, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useTabBarHeight } from '../../../src/hooks/useTabBarHeight';
import { useAuth } from '../../../src/hooks/useAuth';
import { useTutees } from '../../../src/hooks/useTutees';
import { chatService } from '../../../src/services/chatService';
import { ChatThread } from '../../../src/types/chat';
import { Tutee } from '../../../src/types/tutee';

export default function ChatThreadListScreen() {
  const { user } = useAuth();
  const { tutees } = useTutees();
  const tabBarHeight = useTabBarHeight();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creatingThread, setCreatingThread] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = chatService.subscribeToThreads(
      user.id,
      user.role,
      (updatedThreads) => {
        setThreads(updatedThreads);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const getPartnerName = (thread: ChatThread): string => {
    if (user?.role === 'parent') {
      return thread.tutorName || 'Tutor';
    }
    return thread.parentName || 'Parent';
  };

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

  const filteredThreads = threads.filter((thread) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const partnerName = getPartnerName(thread).toLowerCase();
    const studentName = (thread.tuteeName || '').toLowerCase();
    return partnerName.includes(q) || studentName.includes(q);
  });

  const tuteesWithoutThread = tutees.filter((tutee) => {
    return !threads.some((t) => t.tuteeId === tutee.id);
  });

  const filteredTuteesWithoutThread = tuteesWithoutThread.filter((tutee) => {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    const fullName = `${tutee.firstName} ${tutee.surname}`.toLowerCase();
    return fullName.includes(q);
  });

  const handleCreateThread = async (tutee: Tutee) => {
    if (!user) return;
    setCreatingThread(tutee.id);
    try {
      const parentId = tutee.parentId || user.id;
      const tutorId = user.role === 'tutor' ? user.id : user.createdByTutorId || '';
      const thread = await chatService.getOrCreateThread(tutee, parentId, tutorId);
      router.push(`/(main)/chat/${thread.id}`);
    } catch (error) {
      console.error('Failed to create thread:', error);
    } finally {
      setCreatingThread(null);
    }
  };

  const renderThreadItem = ({ item }: { item: ChatThread }) => {
    const partnerName = getPartnerName(item);
    const unreadCount = item.unreadCount?.[user?.id || ''] || 0;

    return (
      <TouchableOpacity
        style={styles.threadItem}
        onPress={() => router.push(`/(main)/chat/${item.id}`)}
      >
        <Avatar.Text
          size={48}
          label={getInitials(partnerName)}
          style={styles.avatar}
          labelStyle={styles.avatarLabel}
        />
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
    );
  };

  const renderTuteeItem = ({ item }: { item: Tutee }) => {
    const isCreating = creatingThread === item.id;
    const fullName = `${item.firstName} ${item.surname}`;

    return (
      <TouchableOpacity
        style={styles.threadItem}
        onPress={() => handleCreateThread(item)}
        disabled={isCreating}
      >
        {item.photoUrl ? (
          <Avatar.Image
            size={48}
            source={{ uri: item.photoUrl }}
            style={styles.avatar}
          />
        ) : (
          <Avatar.Text
            size={48}
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
              <ActivityIndicator size="small" color="#15803d" />
            ) : (
              <MaterialCommunityIcons name="chat-plus-outline" size={20} color="#15803d" />
            )}
          </View>
          <Text style={styles.newThreadSubtitle}>Click to start chat</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Messages',
          headerTintColor: '#15803d',
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
            <ActivityIndicator size="large" color="#15803d" />
            <Text style={styles.loadingText}>Loading chats...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredThreads}
            keyExtractor={(item) => item.id}
            renderItem={renderThreadItem}
            contentContainerStyle={{ paddingBottom: tabBarHeight }}
            ListHeaderComponent={
              filteredTuteesWithoutThread.length > 0 ? (
                <View>
                  <Text style={styles.sectionHeader}>Start a new conversation</Text>
                  {filteredTuteesWithoutThread.map((tutee) => (
                    <View key={tutee.id}>
                      {renderTuteeItem({ item: tutee })}
                    </View>
                  ))}
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.centered}>
                <MaterialCommunityIcons name="chat-outline" size={56} color="#d1d5db" />
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
    backgroundColor: '#ffffff',
  },
  searchbar: {
    margin: 12,
    borderRadius: 12,
    elevation: 0,
    backgroundColor: '#f3f4f6',
  },
  searchbarInput: {
    fontSize: 15,
  },
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  avatar: {
    backgroundColor: '#15803d',
  },
  avatarLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  threadContent: {
    flex: 1,
    marginLeft: 12,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 8,
  },
  studentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  lastMessage: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#15803d',
    marginLeft: 8,
    alignSelf: 'center',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  newThreadSubtitle: {
    fontSize: 12,
    color: '#15803d',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginLeft: 76,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#374151',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
