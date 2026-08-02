import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useTabBarHeight } from '../../src/hooks/useTabBarHeight';
import { useAuth } from '../../src/hooks/useAuth';
import { useTutees } from '../../src/hooks/useTutees';
import { formatTime12h } from '../../src/utils/formatTime';
import { EmptyState } from '../../src/components/EmptyState';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MAP: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0,
};

function normalizeDay(day: string): string {
  if (DAY_MAP[day] !== undefined) return day;
  const abbr = day.slice(0, 3);
  if (DAY_MAP[abbr] !== undefined) return abbr;
  return day;
}

const WEEKS_AHEAD = 4;

interface DatedSession {
  date: Date;
  dayLabel: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  tuteeName: string;
  subject: string;
}

function getNextOccurrences(dayAbbr: string, count: number): Date[] {
  const targetDay = DAY_MAP[dayAbbr];
  if (targetDay === undefined) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentDay = today.getDay();

  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget <= 0) daysUntilTarget += 7;

  const dates: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + daysUntilTarget + i * 7);
    dates.push(d);
  }
  return dates;
}

function formatDateLabel(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${DAY_NAMES[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

function getWeekLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - today.getDay() + 1);
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfNextWeek = new Date(startOfThisWeek);
  startOfNextWeek.setDate(startOfThisWeek.getDate() + 7);

  const startOfWeekAfter = new Date(startOfNextWeek);
  startOfWeekAfter.setDate(startOfNextWeek.getDate() + 7);

  const sessionDate = new Date(date);
  sessionDate.setHours(0, 0, 0, 0);

  if (sessionDate >= startOfThisWeek && sessionDate < startOfNextWeek) return 'This Week';
  if (sessionDate >= startOfNextWeek && sessionDate < startOfWeekAfter) return 'Next Week';

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { tutees, isLoading } = useTutees();
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const sessions: DatedSession[] = [];
  const totalWeeks = WEEKS_AHEAD + 1;

  tutees.forEach((tutee) => {
    if (!Array.isArray(tutee.schedule)) return;
    tutee.schedule.forEach((s) => {
      if (!s || typeof s !== 'object') return;

      const day = normalizeDay(s.day || '');
      if (!day || DAY_MAP[day] === undefined) return;

      const startTime = s.startTime || s.time || '';
      const endTime = s.endTime || '';
      if (!startTime) return;

      const dates = getNextOccurrences(day, totalWeeks);
      dates.forEach((date) => {
        sessions.push({
          date,
          dayLabel: DAY_NAMES[date.getDay()],
          dateLabel: formatDateLabel(date),
          startTime,
          endTime,
          tuteeName: `${tutee.firstName} ${tutee.surname}`,
          subject: tutee.subject || 'Session',
        });
      });
    });
  });

  sessions.sort((a, b) => a.date.getTime() - b.date.getTime());

  const grouped: { label: string; items: DatedSession[] }[] = [];
  sessions.forEach((session) => {
    const weekLabel = getWeekLabel(session.date);
    const existing = grouped.find((g) => g.label === weekLabel);
    if (existing) {
      existing.items.push(session);
    } else {
      grouped.push({ label: weekLabel, items: [session] });
    }
  });

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: '',
        headerTintColor: '#2563eb',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#f9fafb' },
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#2563eb" />
          </TouchableOpacity>
        ),
      }} />
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}>
        {grouped.length === 0 ? (
          <EmptyState
            icon="calendar-blank-outline"
            title="No Schedule"
            message="No tutoring sessions have been scheduled yet."
          />
        ) : (
          grouped.map((group) => (
            <View key={group.label} style={styles.weekSection}>
              <Text style={styles.weekTitle}>{group.label}</Text>
              {group.items.map((session, idx) => (
                <Card key={idx} style={styles.card}>
                  <Card.Content style={styles.cardContent}>
                    <View style={styles.dateColumn}>
                      <Text style={styles.dayLabel}>{session.dayLabel}</Text>
                      <Text style={styles.dateLabel}>{session.dateLabel.split(', ')[1]}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.detailsColumn}>
                      <View style={styles.timeRow}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color="#2563eb" />
                        <Text style={styles.timeText}>
                          {formatTime12h(session.startTime)}{session.endTime ? ` - ${formatTime12h(session.endTime)}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.tuteeName}>{session.tuteeName}</Text>
                      <Text style={styles.subject}>{session.subject}</Text>
                    </View>
                  </Card.Content>
                </Card>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 110 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  weekSection: { marginBottom: 20 },
  weekTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: { marginBottom: 8, borderRadius: 12, elevation: 1 },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateColumn: {
    alignItems: 'center',
    width: 56,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  dateLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 12,
  },
  detailsColumn: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  tuteeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  subject: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
});
