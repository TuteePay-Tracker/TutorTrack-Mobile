import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useTabBarHeight } from '../../src/hooks/useTabBarHeight';
import { useAuth } from '../../src/hooks/useAuth';
import { useTutees } from '../../src/hooks/useTutees';
import { formatTime12h } from '../../src/utils/formatTime';
import { EmptyState } from '../../src/components/EmptyState';

const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { tutees, isLoading } = useTutees();
  const tabBarHeight = useTabBarHeight();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  const allSchedule: { day: string; startTime: string; endTime: string; tuteeName: string; subject: string }[] = [];
  tutees.forEach((tutee) => {
    if (Array.isArray(tutee.schedule)) {
      tutee.schedule.forEach((s) => {
        if (s && typeof s === 'object' && 'startTime' in s) {
          allSchedule.push({
            day: s.day,
            startTime: s.startTime || '',
            endTime: s.endTime || '',
            tuteeName: `${tutee.firstName} ${tutee.surname}`,
            subject: tutee.subject || 'Session',
          });
        }
      });
    }
  });

  const sorted = allSchedule.sort((a, b) => {
    const aIdx = dayOrder.indexOf(a.day);
    const bIdx = dayOrder.indexOf(b.day);
    return (aIdx === -1 ? 7 : aIdx) - (bIdx === -1 ? 7 : bIdx);
  });

  const grouped = dayOrder.reduce<Record<string, typeof sorted>>((acc, day) => {
    acc[day] = sorted.filter((s) => s.day === day);
    return acc;
  }, {});

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Schedule', headerTintColor: '#15803d' }} />
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}>
        {sorted.length === 0 ? (
          <EmptyState
            icon="calendar-blank-outline"
            title="No Schedule"
            message="No tutoring sessions have been scheduled yet."
          />
        ) : (
          Object.entries(grouped).map(([day, items]) =>
            items.length > 0 ? (
              <View key={day} style={styles.daySection}>
                <Text style={styles.dayTitle}>{day}</Text>
                {items.map((s, idx) => (
                  <Card key={idx} style={styles.card}>
                    <Card.Content style={styles.cardRow}>
                      <View style={styles.timeColumn}>
                        <MaterialCommunityIcons name="clock-outline" size={18} color="#15803d" />
                        <Text style={styles.timeText}>
                          {formatTime12h(s.startTime)} - {formatTime12h(s.endTime)}
                        </Text>
                      </View>
                      <View style={styles.infoColumn}>
                        <Text style={styles.tuteeName}>{s.tuteeName}</Text>
                        <Text style={styles.subject}>{s.subject}</Text>
                      </View>
                    </Card.Content>
                  </Card>
                ))}
              </View>
            ) : null
          )
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 110 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  daySection: { marginBottom: 16 },
  dayTitle: { fontSize: 16, fontWeight: '800', color: '#15803d', marginBottom: 8, textTransform: 'uppercase' },
  card: { marginBottom: 8, borderRadius: 12, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  timeColumn: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 140 },
  timeText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  infoColumn: { flex: 1 },
  tuteeName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  subject: { fontSize: 12, color: '#6b7280', marginTop: 1 },
});
