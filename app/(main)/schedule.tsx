import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTabBarHeight } from '../../src/hooks/useTabBarHeight';
import { useAuth } from '../../src/hooks/useAuth';
import { useTutees } from '../../src/hooks/useTutees';
import { useSchoolYear } from '../../src/contexts/SchoolYearContext';
import { isMonthInSchoolYear } from '../../src/utils/schoolYear';
import { paymentService, AttendanceRecord } from '../../src/services/paymentService';
import { Payment } from '../../src/types/payment';
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

interface DatedSession {
  date: Date;
  dayLabel: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  tuteeName: string;
  subject: string;
  isMakeUp?: boolean;
}

function formatDateLabel(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${DAY_NAMES[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

function getWeekLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfThisWeek = new Date(today);
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start of week
  startOfThisWeek.setDate(today.getDate() + diff);
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfNextWeek = new Date(startOfThisWeek);
  startOfNextWeek.setDate(startOfThisWeek.getDate() + 7);

  const startOfWeekAfter = new Date(startOfNextWeek);
  startOfWeekAfter.setDate(startOfNextWeek.getDate() + 7);

  const sessionDate = new Date(date);
  sessionDate.setHours(0, 0, 0, 0);

  if (sessionDate >= startOfThisWeek && sessionDate < startOfNextWeek) return 'This Week';
  if (sessionDate >= startOfNextWeek && sessionDate < startOfWeekAfter) return 'Next Week';

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function getMatchingScheduleSlots(
  schedule: any,
  dayName: string
): Array<{ startTime?: string; endTime?: string; time?: string; subject?: string }> {
  if (!Array.isArray(schedule)) return [];

  const targetDayNum = DAY_MAP[dayName];
  if (targetDayNum === undefined) return [];

  const matches: Array<{ startTime?: string; endTime?: string; time?: string; subject?: string }> = [];

  schedule.forEach((s) => {
    if (!s || typeof s !== 'object') return;
    const normalized = normalizeDay(s.day || '');
    if (DAY_MAP[normalized] === targetDayNum) {
      matches.push(s);
    }
  });

  return matches;
}

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { tutees, isLoading: tuteesLoading } = useTutees();
  const { selectedYear } = useSchoolYear();
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const { from, tuteeId } = useLocalSearchParams<{ from?: string; tuteeId?: string }>();

  const [paymentRecords, setPaymentRecords] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const focusTuteeId = tuteeId || (from?.startsWith('children/') ? from.split('/')[1] : undefined);
  const scopeTutees = useMemo(() => {
    return focusTuteeId ? tutees.filter((t) => t.id === focusTuteeId) : tutees;
  }, [tutees, focusTuteeId]);

  const scopeTuteeIds = useMemo(() => {
    return scopeTutees.map((t) => t.id).sort().join(',');
  }, [scopeTutees]);

  // Subscribe in real-time to payment/billing records for the scoped tutees
  useEffect(() => {
    const tutorId = user?.role === 'parent' ? user.createdByTutorId : user?.id;
    if (!tutorId || scopeTutees.length === 0) {
      setPaymentRecords([]);
      setPayments([]);
      setRecordsLoading(false);
      return;
    }

    setRecordsLoading(true);
    const ids = scopeTutees.map((t) => t.id);

    const unsubRecords = paymentService.subscribeRecordsForTutees(
      tutorId,
      ids,
      (recs) => {
        setPaymentRecords(recs);
        setRecordsLoading(false);
      },
      (err) => {
        console.error('Error fetching payment records for schedule:', err);
        setRecordsLoading(false);
      }
    );

    const unsubPayments = paymentService.subscribeAllPayments(
      tutorId,
      ids,
      (pays) => {
        setPayments(pays);
      }
    );

    return () => {
      unsubRecords();
      unsubPayments();
    };
  }, [user?.role, user?.createdByTutorId, user?.id, scopeTuteeIds]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Map of tuteeId -> Set of valid "YYYY-MM" months that exist in Firestore billing/payment records
  const tuteeValidMonthsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    scopeTutees.forEach((t) => map.set(t.id, new Set<string>()));

    paymentRecords.forEach((rec) => {
      if (rec.tuteeId && rec.month) {
        if (!selectedYear || isMonthInSchoolYear(rec.month, selectedYear)) {
          if (!map.has(rec.tuteeId)) map.set(rec.tuteeId, new Set<string>());
          map.get(rec.tuteeId)!.add(rec.month);
        }
      }
    });

    payments.forEach((p) => {
      if (p.tuteeId && p.month) {
        if (!selectedYear || isMonthInSchoolYear(p.month, selectedYear)) {
          if (!map.has(p.tuteeId)) map.set(p.tuteeId, new Set<string>());
          map.get(p.tuteeId)!.add(p.month);
        }
      }
    });

    return map;
  }, [scopeTutees, paymentRecords, payments, selectedYear]);

  // Construct sessions only for months with existing payment or billing records
  const sessions = useMemo(() => {
    const list: DatedSession[] = [];

    scopeTutees.forEach((tutee) => {
      const validMonths = tuteeValidMonthsMap.get(tutee.id);
      if (!validMonths || validMonths.size === 0) return;

      validMonths.forEach((monthKey) => {
        const record = paymentRecords.find((r) => r.tuteeId === tutee.id && r.month === monthKey);

        if (record && Array.isArray(record.dayPayments) && record.dayPayments.length > 0) {
          // Use scheduled day records from Firestore payment record
          record.dayPayments.forEach((dp) => {
            if (dp.status === 'no-class') return; // Exclude cancelled/no-class sessions

            const [y, m, d] = dp.date.split('-').map(Number);
            if (!y || !m || !d) return;
            const date = new Date(y, m - 1, d);
            const dayName = DAY_NAMES[date.getDay()];
            const isMakeUp = dp.sessionType === 'make-up' || Boolean(dp.makeUpCreditId);

            if (isMakeUp) {
              // Make-up sessions use their own scheduled time, not the weekly slot.
              list.push({
                date,
                dayLabel: dayName,
                dateLabel: formatDateLabel(date),
                startTime: dp.startTime || '',
                endTime: dp.endTime || '',
                tuteeName: `${tutee.firstName} ${tutee.surname}`,
                subject: 'Make-up class',
                isMakeUp: true,
              });
              return;
            }

            const matchingSlots = getMatchingScheduleSlots(tutee.schedule, dayName);

            if (matchingSlots.length > 0) {
              matchingSlots.forEach((slot) => {
                list.push({
                  date,
                  dayLabel: dayName,
                  dateLabel: formatDateLabel(date),
                  startTime: slot.startTime || slot.time || '',
                  endTime: slot.endTime || '',
                  tuteeName: `${tutee.firstName} ${tutee.surname}`,
                  subject: slot.subject || tutee.subject || 'Session',
                });
              });
            } else {
              list.push({
                date,
                dayLabel: dayName,
                dateLabel: formatDateLabel(date),
                startTime: '',
                endTime: '',
                tuteeName: `${tutee.firstName} ${tutee.surname}`,
                subject: tutee.subject || 'Session',
              });
            }
          });
        } else {
          // If record exists for month but dayPayments is not populated, calculate days in month
          const [yearStr, monthStr] = monthKey.split('-');
          const year = parseInt(yearStr, 10);
          const monthIndex = parseInt(monthStr, 10) - 1;
          if (isNaN(year) || isNaN(monthIndex)) return;

          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
          for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
            const date = new Date(year, monthIndex, dayNum);
            const dayName = DAY_NAMES[date.getDay()];
            const matchingSlots = getMatchingScheduleSlots(tutee.schedule, dayName);

            matchingSlots.forEach((slot) => {
              list.push({
                date,
                dayLabel: dayName,
                dateLabel: formatDateLabel(date),
                startTime: slot.startTime || slot.time || '',
                endTime: slot.endTime || '',
                tuteeName: `${tutee.firstName} ${tutee.surname}`,
                subject: slot.subject || tutee.subject || 'Session',
              });
            });
          }
        }
      });
    });

    list.sort((a, b) => {
      const timeDiff = a.date.getTime() - b.date.getTime();
      if (timeDiff !== 0) return timeDiff;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    return list;
  }, [scopeTutees, tuteeValidMonthsMap, paymentRecords]);

  // Group sessions by week or month label
  const grouped = useMemo(() => {
    const groupedMap = new Map<string, DatedSession[]>();
    sessions.forEach((session) => {
      const weekLabel = getWeekLabel(session.date);
      if (!groupedMap.has(weekLabel)) {
        groupedMap.set(weekLabel, []);
      }
      groupedMap.get(weekLabel)!.push(session);
    });

    const result = Array.from(groupedMap.entries()).map(([label, items]) => ({
      label,
      items,
    }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    result.sort((a, b) => {
      if (a.label === 'This Week') return -1;
      if (b.label === 'This Week') return 1;

      if (a.label === 'Next Week') return -1;
      if (b.label === 'Next Week') return 1;

      const aDate = a.items[0]?.date.getTime() || 0;
      const bDate = b.items[0]?.date.getTime() || 0;

      const aIsFuture = aDate >= today.getTime();
      const bIsFuture = bDate >= today.getTime();

      if (aIsFuture && !bIsFuture) return -1;
      if (!aIsFuture && bIsFuture) return 1;

      if (aIsFuture && bIsFuture) {
        return aDate - bDate;
      }
      return bDate - aDate;
    });

    return result;
  }, [sessions]);

  if (tuteesLoading || recordsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTintColor: '#2563eb',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#eff6ff' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
              <MaterialCommunityIcons name="chevron-left" size={28} color="#2563eb" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
      >
        {grouped.length === 0 ? (
          <EmptyState
            icon="calendar-blank-outline"
            title="No Schedule"
            message="No tutoring sessions have been scheduled yet for billing periods on file."
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
                      <Text style={styles.dateLabel}>{session.dateLabel.split(', ')[1] || session.dateLabel}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.detailsColumn}>
                      {session.startTime ? (
                        <View style={styles.timeRow}>
                          <MaterialCommunityIcons name="clock-outline" size={14} color="#2563eb" />
                          <Text style={styles.timeText}>
                            {formatTime12h(session.startTime)}
                            {session.endTime ? ` - ${formatTime12h(session.endTime)}` : ''}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.nameRow}>
                        <Text style={styles.tuteeName}>{session.tuteeName}</Text>
                        {session.isMakeUp && (
                          <View style={styles.makeUpBadge}>
                            <Text style={styles.makeUpBadgeText}>Make-up</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.subject, session.isMakeUp && styles.makeUpSubject]}>
                        {session.subject}
                      </Text>
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
  container: { flex: 1, backgroundColor: '#eff6ff' },
  content: { padding: 16, paddingBottom: 110 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#eff6ff' },
  weekSection: { marginBottom: 20 },
  weekTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: { marginBottom: 8, borderRadius: 12, elevation: 1, backgroundColor: '#ffffff' },
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
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
  makeUpSubject: {
    color: '#b45309',
    fontWeight: '600',
  },
  makeUpBadge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  makeUpBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b45309',
    textTransform: 'uppercase',
  },
});
