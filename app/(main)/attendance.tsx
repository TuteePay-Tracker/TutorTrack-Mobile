import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTabBarHeight } from '../../src/hooks/useTabBarHeight';
import { useAuth } from '../../src/hooks/useAuth';
import { useTutees } from '../../src/hooks/useTutees';
import { paymentService, AttendanceRecord } from '../../src/services/paymentService';
import { EmptyState } from '../../src/components/EmptyState';

const DAY_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  present: { label: 'Present', color: '#059669', bg: '#f0fdf4' },
  absent: { label: 'Absent', color: '#dc2626', bg: '#fef2f2' },
  'no-class': { label: 'No Class', color: '#7c3aed', bg: '#f5f3ff' },
};

const defaultDayConfig = { label: 'Unmarked', color: '#6b7280', bg: '#f3f4f6' };

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
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<Record<string, string>>({});
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const focusTuteeId = from?.startsWith('children/') ? from.split('/')[1] : undefined;
  const scopeTutees = focusTuteeId ? tutees.filter((t) => t.id === focusTuteeId) : tutees;
  const focusedTutee = focusTuteeId ? tutees.find((t) => t.id === focusTuteeId) : null;
  const scopeTuteeIds = scopeTutees.map((t) => t.id).sort().join(',');

  useEffect(() => {
    if (!user?.createdByTutorId || scopeTutees.length === 0) {
      setRecords([]);
      setLoading(false);
      return;
    }
    const tutorId = user.createdByTutorId;
    setLoading(true);
    setError(null);

    const unsub = paymentService.subscribeRecordsForTutees(
      tutorId,
      scopeTutees.map((t) => t.id),
      (recs) => {
        setRecords(recs);
        setLoading(false);
      },
      () => {
        setError('Could not load attendance. Please try again.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.createdByTutorId, scopeTuteeIds, reloadKey]);

  const attendanceMap = useMemo(() => {
    const map: Record<string, { presentCount: number; totalSessions: number }> = {};
    scopeTutees.forEach((t) => {
      map[t.id] = { presentCount: 0, totalSessions: 0 };
    });
    records.forEach((r) => {
      const tuteeId = r.tuteeId;
      if (!tuteeId || !map[tuteeId]) return;
      (r.dayPayments || []).forEach((dp) => {
        if (dp.resolvedStatus === 'present') map[tuteeId].presentCount++;
        if (dp.resolvedStatus !== 'no-class') map[tuteeId].totalSessions++;
      });
    });
    return map;
  }, [records, scopeTutees]);

  const recordsMap = useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {};
    scopeTutees.forEach((t) => {
      map[t.id] = [];
    });
    records.forEach((r) => {
      const tuteeId = r.tuteeId;
      if (tuteeId && map[tuteeId]) map[tuteeId].push(r);
    });
    return map;
  }, [records, scopeTutees]);

  if (isLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="cloud-alert-outline" size={40} color="#dc2626" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => setReloadKey((k) => k + 1)}
          activeOpacity={0.8}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  let totalAttended = 0;
  let totalSessions = 0;
  Object.values(attendanceMap).forEach((att) => {
    totalAttended += att.presentCount;
    totalSessions += att.totalSessions;
  });
  const overallRate = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0;

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
            const rate = att.totalSessions > 0 ? Math.round((att.presentCount / att.totalSessions) * 100) : 0;
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
                    <View style={styles.monthDropdownWrap}>
                      {(() => {
                        const monthOptions = records.map((r) => r.month);
                        const selectedMonth = selectedMonths[tutee.id] ?? records[0]?.month;
                        const record = records.find((r) => r.month === selectedMonth);
                        return (
                          <>
                            <TouchableOpacity
                              style={[styles.monthDropdownButton, openDropdownId === tutee.id && styles.monthDropdownButtonActive]}
                              onPress={() => setOpenDropdownId(openDropdownId === tutee.id ? null : tutee.id)}
                              activeOpacity={0.7}
                            >
                              <MaterialCommunityIcons name="calendar-month-outline" size={18} color="#2563eb" />
                              <Text style={styles.monthDropdownText}>{formatMonthLabel(selectedMonth ?? '')}</Text>
                              <MaterialCommunityIcons name="chevron-down" size={20} color="#9ca3af" />
                            </TouchableOpacity>

                            {record && record.dayPayments.length > 0 && (
                              <View style={styles.monthSection}>
                                <View style={styles.monthHeader}>
                                  <Text style={styles.monthTitle}>{formatMonthLabel(record.month)}</Text>
                                  <View style={styles.countChipRow}>
                                    <View style={[styles.countChip, { backgroundColor: '#f0fdf4' }]}>
                                      <Text style={[styles.countChipText, { color: '#059669' }]}>
                                        {record.dayPayments.filter((d) => d.resolvedStatus === 'present').length} Present
                                      </Text>
                                    </View>
                                    <View style={[styles.countChip, { backgroundColor: '#fef2f2' }]}>
                                      <Text style={[styles.countChipText, { color: '#dc2626' }]}>
                                        {record.dayPayments.filter((d) => d.resolvedStatus === 'absent').length} Absent
                                      </Text>
                                    </View>
                                    {record.dayPayments.some((d) => d.resolvedStatus === 'no-class') && (
                                      <View style={[styles.countChip, { backgroundColor: '#f5f3ff' }]}>
                                        <Text style={[styles.countChipText, { color: '#7c3aed' }]}>
                                          {record.dayPayments.filter((d) => d.resolvedStatus === 'no-class').length} No Class
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                </View>
                                <View style={styles.dayGrid}>
                                  {record.dayPayments.map((day) => {
                                    const config = DAY_STATUS_CONFIG[day.resolvedStatus] || defaultDayConfig;
                                    return (
                                      <View key={day.date} style={[styles.dayChip, { backgroundColor: config.bg }]}>
                                        <Text style={[styles.dayChipDate, { color: config.color }]}>{formatDayLabel(day.date)}</Text>
                                        <Text style={[styles.dayChipStatus, { color: config.color }]}>{config.label}</Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              </View>
                            )}
                          </>
                        );
                      })()}
                    </View>
                  )}
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={openDropdownId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenDropdownId(null)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setOpenDropdownId(null)}
        >
          <View style={styles.dropdownSheet}>
            {(() => {
              const dropdownTutee = scopeTutees.find((t) => t.id === openDropdownId);
              const monthOptions = (recordsMap[openDropdownId ?? ''] || []).map((r) => r.month);
              const selectedMonth = selectedMonths[openDropdownId ?? ''] ?? monthOptions[0];
              return monthOptions.map((ym) => {
                const isSelected = selectedMonth === ym;
                return (
                  <TouchableOpacity
                    key={ym}
                    style={[styles.dropdownOption, isSelected && styles.dropdownOptionSelected]}
                    onPress={() => {
                      if (openDropdownId) {
                        setSelectedMonths((prev) => ({ ...prev, [openDropdownId]: ym }));
                      }
                      setOpenDropdownId(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="calendar-month-outline"
                      size={18}
                      color={isSelected ? '#2563eb' : '#6b7280'}
                    />
                    <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}>
                      {formatMonthLabel(ym)}
                    </Text>
                    {dropdownTutee && isSelected && (
                      <MaterialCommunityIcons name="check" size={18} color="#2563eb" />
                    )}
                  </TouchableOpacity>
                );
              });
            })()}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eff6ff' },
  content: { padding: 16, paddingBottom: 110 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#eff6ff' },
  errorText: { fontSize: 14, fontWeight: '600', color: '#dc2626', textAlign: 'center', marginTop: 12, paddingHorizontal: 32 },
  retryButton: { marginTop: 16, backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  summaryCard: { marginBottom: 16, borderRadius: 16, elevation: 2, backgroundColor: '#2563eb' },
  summaryContent: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 16 },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 24, fontWeight: '800', color: '#ffffff' },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 4, textTransform: 'uppercase' },
  divider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.3)' },
  card: { marginBottom: 10, borderRadius: 14, elevation: 1, backgroundColor: '#ffffff' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardLeft: { flex: 1 },
  childName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sessionInfo: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  rateBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  rateText: { fontSize: 16, fontWeight: '800' },
  noHistoryText: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },
  monthDropdownWrap: { marginTop: 12 },
  monthDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  monthDropdownButtonActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  monthDropdownText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  dropdownSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 8,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  dropdownOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  dropdownOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  dropdownOptionTextSelected: {
    color: '#2563eb',
  },
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
