import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/hooks/useAuth';
import { useTabBarHeight } from '../../../src/hooks/useTabBarHeight';
import { announcementService } from '../../../src/services/announcementService';
import { Announcement } from '../../../src/types/announcement';
import { AnnouncementCard } from '../../../src/components/AnnouncementCard';
import { EmptyState } from '../../../src/components/EmptyState';

export default function AnnouncementsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.createdByTutorId) return;

    setLoading(true);
    const unsubscribe = announcementService.subscribe(
      user.createdByTutorId,
      (data: Announcement[]) => {
        setAnnouncements(data);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [user?.createdByTutorId]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (user?.createdByTutorId) {
      announcementService.subscribe(
        user.createdByTutorId,
        (data: Announcement[]) => {
          setAnnouncements(data);
          setRefreshing(false);
        }
      );
    } else {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <MaterialCommunityIcons name="bullhorn" size={28} color="#15803d" />
        <View style={styles.headerText}>
          <Text style={styles.title}>Announcements</Text>
          <Text style={styles.subtitle}>Updates from your tutor</Text>
        </View>
      </View>

      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AnnouncementCard
            announcement={item}
            onPress={() => router.push(`/(main)/announcements/${item.id}`)}
          />
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#15803d"]}
            tintColor="#15803d"
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="bullhorn-outline"
            title="No announcements"
            message="There are no announcements from your tutor yet."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerText: {
    marginLeft: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
});
