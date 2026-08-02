import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTabBarHeight } from '../../src/hooks/useTabBarHeight';
import { useAuth } from '../../src/hooks/useAuth';
import { useTutees } from '../../src/hooks/useTutees';
import { paymentService, AttendanceRecord } from '../../src/services/paymentService';
import { EmptyState } from '../../src/components/EmptyState';

const DAY_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: 'Present', color: '#059669', bg: '#f0fdf4' },
  partial: { label: 'Absent', color: '#dc2626', bg: '#fef2f2' },
  'no-class': { label: 'No Class', color: '#7c3aed', bg: '#f5f3ff' },
};

const defaultDayConfig = { label: 'Not Marked', color: '#6b7280', bg: '#f3f4f6' };

const formatDayLabel = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatMonthLabel = (month: string): string => {
  const date = new Date(month + '-01T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export default function AttendanceScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { tutees, isLoading } = useTutees();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const tabBarHeight = useTabBarHeight();
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { presentCount: number; totalSessions: number }>>({});
  const [recordsMap, setRecordsMap] = useState<Record<string, AttendanceRecord[]>>({});
  const [loading, setLoading] = useState(true);

  const focusTuteeId = from?.startsWith('children/') ? from.split('/')[1] : undefined;
  const scopeTutees = focusTuteeId ? tutees.filter((t) => t.id === focusTuteeId) : tutees;
  const focusedTutee = focusTuteeId ? tutees.find((t) => t.id === focusTuteeId) : null;

  useEffect(() => {
    if (!user?.createdByTutorId || scopeTutees.length === 0) {
      setLoading(false);
      return;
    }
    const tutorId = user.createdByTutorId;

    const cleanups: (() => void)[] = [];
    scopeTutees.forEach((tutee) => {
      const unsub = paymentService.subscribeAttendanceByTutee(tutorId, tutee.id, (att) => {
        setAttendanceMap((prev) => ({ ...prev, [tutee.id]: att }));
        setLoading(false);
      });
      cleanups.push(unsub);

      const unsubRecords = paymentService.subscribeAttendanceRecords(tutorId, tutee.id, (records) => {
        setRecordsMap((prev) => ({ ...prev, [tutee.id]: records }));
        setLoading(false);
      });
      cleanups.push(unsubRecords);
    });

    return () => cleanups.forEach((u) => u());
  }, [user?.createdByTutorId, focusTuteeId, tutees]);

  if (isLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  let totalAttended = 0;
  let totalSessions = 0;
  Object.values(attendanceMap).forEach((att) => {
    totalAttended += att.presentCount;
    totalSessions += att.totalSessions;
  });
  const overallRate = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 100;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: focusedTutee ? `${focusedTutee.firstName}'s Attendance` : 'Attendance',
          headerTintColor: '#2563eb',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
              <MaterialCommunityIcons name="chevron-left" size={28} color="#2563eb" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}>
        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{overallRate}%</Text>
              <Text style={styles.summaryLabel}>Overall Rate</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalAttended}</Text>
              <Text style={styles.summaryLabel}>Attended</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalSessions}</Text>
              <Text style={styles.summaryLabel}>Total Sessions</Text>
            </View>
          </Card.Content>
        </Card>

        {scopeTutees.length === 0 ? (
          <EmptyState
            icon="account-group-outline"
            title="No Children"
            message="No children linked to your account yet."
          />
        ) : (
          scopeTutees.map((tutee) => {
            const att = attendanceMap[tutee.id] || { presentCount: 0, totalSessions: 0 };
            const rate = att.totalSessions > 0 ? Math.round((att.presentCount / att.totalSessions) * 100) : 100;
            const records = recordsMap[tutee.id] || [];

            return (
              <Card key={tutee.id} style={styles.card}>
                <Card.Content>
                  <View style={styles.cardRow}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.childName}>{tutee.firstName} {tutee.surname}</Text>
                      <Text style={styles.sessionInfo}>
                        {att.presentCount} of {att.totalSessions} sessions attended
                      </Text>
                    </View>
                    <View style={[styles.rateBadge, { backgroundColor: rate >= 80 ? '#dbeafe' : rate >= 50 ? '#fef3c7' : '#fef2f2' }]}>
                      <Text style={[styles.rateText, { color: rate >= 80 ? '#2563eb' : rate >= 50 ? '#d97706' : '#dc2626' }]}>
                        {rate}%
                      </Text>
                    </View>
                  </View>

                  {records.length === 0 ? (
                    <Text style={styles.noHistoryText}>No attendance history yet</Text>
                  ) : (
                    records.map((record) => {
                      if (record.dayPayments.length === 0) return null;
                      const present = record.dayPayments.filter((d) => d.status === 'paid').length;
                      const absent = record.dayPayments.filter((d) => d.status === 'partial').length;
                      const noClass = record.dayPayments.filter((d) => d.status === 'no-class').length;

                      return (
                        <View key={record.id} style={styles.monthSection}>
                          <View style={styles.monthHeader}>
                            <Text style={styles.monthTitle}>{formatMonthLabel(record.month)}</Text>
                            <View style={styles.countChipRow}>
                              <View style={[styles.countChip, { backgroundColor: '#f0fdf4' }]}>
                                <Text style={[styles.countChipText, { color: '#059669' }]}>{present} Present</Text>
                              </View>
                              <View style={[styles.countChip, { backgroundColor: '#fef2f2' }]}>
                                <Text style={[styles.countChipText, { color: '#dc2626' }]}>{absent} Absent</Text>
                              </View>
                              {noClass > 0 && (
                                <View style={[styles.countChip, { backgroundColor: '#f5f3ff' }]}>
                                  <Text style={[styles.countChipText, { color: '#7c3aed' }]}>{noClass} No Class</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <View style={styles.dayGrid}>
                            {record.dayPayments.map((day) => {
                              const config = DAY_STATUS_CONFIG[day.status] || defaultDayConfig;
                              return (
                                <View key={day.date} style={[styles.dayChip, { backgroundColor: config.bg }]}>
                                  <Text style={[styles.dayChipDate, { color: config.color }]}>{formatDayLabel(day.date)}</Text>
                                  <Text style={[styles.dayChipStatus, { color: config.color }]}>{config.label}</Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })
                  )}
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 110 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  summaryCard: { marginBottom: 16, borderRadius: 16, elevation: 2, backgroundColor: '#2563eb' },
  summaryContent: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 16 },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 24, fontWeight: '800', color: '#ffffff' },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 4, textTransform: 'uppercase' },
  divider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.3)' },
  card: { marginBottom: 10, borderRadius: 14, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardLeft: { flex: 1 },
  childName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sessionInfo: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  rateBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  rateText: { fontSize: 16, fontWeight: '800' },
  noHistoryText: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },
  monthSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  monthTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  countChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  countChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  countChipText: { fontSize: 11, fontWeight: '800' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  dayChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, minWidth: 92, alignItems: 'center' },
  dayChipDate: { fontSize: 11, fontWeight: '700' },
  dayChipStatus: { fontSize: 10, fontWeight: '800', marginTop: 1, textTransform: 'uppercase' },
});
