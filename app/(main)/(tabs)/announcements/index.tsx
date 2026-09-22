import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../../src/hooks/useAuth';
import { useSchoolYear } from '../../../../src/contexts/SchoolYearContext';
import { useTabBarHeight } from '../../../../src/hooks/useTabBarHeight';
import { announcementService } from '../../../../src/services/announcementService';
import { Announcement } from '../../../../src/types/announcement';
import { AnnouncementCard } from '../../../../src/components/AnnouncementCard';
import { EmptyState } from '../../../../src/components/EmptyState';
import { belongsToSchoolYear } from '../../../../src/utils/schoolYear';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function AnnouncementsScreen() {
  const { user } = useAuth();
  const { selectedYear } = useSchoolYear();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user?.createdByTutorId) return;

    setLoading(true);
    const unsubscribe = announcementService.subscribe(
      user.createdByTutorId,
      (data: Announcement[]) => {
        setAnnouncements(
          data
            .filter((a) => belongsToSchoolYear(selectedYear, a))
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        );
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [user?.createdByTutorId, selectedYear]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (user?.createdByTutorId) {
      announcementService.subscribe(
        user.createdByTutorId,
        (data: Announcement[]) => {
          setAnnouncements(
            data
              .filter((a) => belongsToSchoolYear(selectedYear, a))
              .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
          );
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
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <MaterialCommunityIcons name="bullhorn" size={28} color="#2563eb" />
        <View style={styles.headerText}>
          <Text style={styles.title}>Announcements</Text>
          <Text style={styles.subtitle}>Updates from your tutor</Text>
        </View>
      </View>

      <FlatList
        data={expanded ? announcements : announcements.slice(0, 5)}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40).duration(200)}>
            <AnnouncementCard
              announcement={item}
              onPress={() => router.navigate(`/(main)/announcements/${item.id}`)}
            />
          </Animated.View>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#2563eb"]}
            tintColor="#2563eb"
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="bullhorn-outline"
            title="No announcements"
            message="There are no announcements from your tutor yet."
          />
        }
        ListFooterComponent={
          announcements.length > 5 ? (
            <TouchableOpacity style={styles.footerButton} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
              <Text style={styles.footerButtonText}>{expanded ? 'See Less' : 'See More'}</Text>
              <MaterialCommunityIcons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#2563eb"
              />
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff6ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#eff6ff',
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
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 12,
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
});
