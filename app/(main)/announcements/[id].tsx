import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/hooks/useAuth';
import { announcementService } from '../../../src/services/announcementService';
import { Announcement } from '../../../src/types/announcement';

const priorityConfig = {
  high: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', label: 'HIGH' },
  medium: { bg: '#fffbeb', border: '#fde68a', text: '#d97706', label: 'MEDIUM' },
  low: { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', label: 'LOW' },
};

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user?.createdByTutorId) return;

    const unsubscribe = announcementService.subscribe(
      user.createdByTutorId,
      (data: Announcement[]) => {
        const found = data.find((a) => a.id === id);
        setAnnouncement(found || null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id, user?.createdByTutorId]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  if (!announcement) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#d1d5db" />
        <Text style={styles.notFoundText}>Announcement not found</Text>
      </View>
    );
  }

  const priority = priorityConfig[announcement.priority] || priorityConfig.medium;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Announcement',
          headerTintColor: '#15803d',
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: 16 }]}
      >
        <View style={[styles.badge, { backgroundColor: priority.bg, borderColor: priority.border }]}>
          <Text style={[styles.badgeText, { color: priority.text }]}>{priority.label}</Text>
        </View>

        <Text style={styles.title}>{announcement.title}</Text>
        <Text style={styles.date}>Posted on {formatDate(announcement.createdAt)}</Text>

        <View style={styles.divider} />

        <Text style={styles.body}>{announcement.content}</Text>
      </ScrollView>
    </>
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
  notFoundText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  content: {
    padding: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  date: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 20,
  },
  body: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 26,
  },
});
