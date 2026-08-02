import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Announcement } from '../types/announcement';
import { ScaleOnPress } from './ScaleOnPress';

interface AnnouncementCardProps {
  announcement: Announcement;
  onPress?: () => void;
}

const priorityConfig = {
  high: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', label: 'HIGH' },
  medium: { bg: '#fffbeb', border: '#fde68a', text: '#d97706', label: 'MEDIUM' },
  low: { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', label: 'LOW' },
};

export const AnnouncementCard = ({ announcement, onPress }: AnnouncementCardProps) => {
  const priority = priorityConfig[announcement.priority] || priorityConfig.medium;
  const date = announcement.createdAt?.toDate?.()
    ? announcement.createdAt.toDate().toLocaleDateString()
    : new Date(announcement.createdAt).toLocaleDateString();

  return (
    <ScaleOnPress onPress={onPress} disabled={!onPress} style={styles.card}>
      <Card>
        <Card.Content>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{announcement.title}</Text>
            <View style={[styles.badge, { backgroundColor: priority.bg, borderColor: priority.border }]}>
              <Text style={[styles.badgeText, { color: priority.text }]}>{priority.label}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.content}>{announcement.content}</Text>
        <Text style={styles.date}>Posted on {date}</Text>
      </Card.Content>
    </Card>
    </ScaleOnPress>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 16,
    elevation: 1,
  },
  header: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  content: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  date: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 10,
  },
});
