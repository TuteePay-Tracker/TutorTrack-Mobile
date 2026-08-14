import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Text, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/hooks/useAuth';
import { useTutees } from '../../../src/hooks/useTutees';
import { useTabBarHeight } from '../../../src/hooks/useTabBarHeight';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { formatTime12h } from '../../../src/utils/formatTime';
import { paymentService } from '../../../src/services/paymentService';
import { assessmentService } from '../../../src/services/assessmentService';
import { announcementService } from '../../../src/services/announcementService';
import { Announcement } from '../../../src/types/announcement';
import { Assessment } from '../../../src/types/assessment';
import { KpiCard } from '../../../src/components/KpiCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { ScaleOnPress } from '../../../src/components/ScaleOnPress';
import { AnimatedBar } from '../../../src/components/AnimatedBar';
import Animated, { FadeInDown } from 'react-native-reanimated';

const CHART_COLORS = ['#2563eb', '#f59e0b', '#3b82f6'];

const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll: () => void }) {
  return (
    <TouchableOpacity style={styles.sectionHeaderRow} onPress={onSeeAll} activeOpacity={0.7}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.seeAllRow}>
        <Text style={styles.seeAllText}>See All</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color="#2563eb" />
      </View>
    </TouchableOpacity>
  );
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const { tutees, isLoading: tuteesLoading } = useTutees();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [payments, setPayments] = useState<Record<string, number>>({});
  const [verifiedPayments, setVerifiedPayments] = useState<Record<string, number>>({});
  const [attendance, setAttendance] = useState<Record<string, { presentCount: number; totalSessions: number }>>({});
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const tutorId = user?.createdByTutorId || '';

  const loadData = useCallback(() => {
    if (!tutorId || !tutees.length) {
      setLoading(false);
      return;
    }

    const tuteeIds = tutees.map((t) => t.id);

    const unsubAnnouncements = announcementService.subscribe(tutorId, (data: Announcement[]) => {
      setAnnouncements(data);
    });

    const unsubAssessments = assessmentService.subscribeAll(tutorId, tuteeIds, (data: Assessment[]) => {
      setAssessments(data);
    });

    const unsubPayments: (() => void)[] = [];
    const unsubAttendance: (() => void)[] = [];

    tutees.forEach((tutee) => {
      unsubPayments.push(
        paymentService.subscribeTransactionsByTutee(tutorId, tutee.id, (total: number) => {
          setPayments((prev) => ({ ...prev, [tutee.id]: total }));
        })
      );
      // Also subscribe to verified parent proof payments
      unsubPayments.push(
        paymentService.subscribeVerifiedAmountByTutee(tutorId, tutee.id, (verified: number) => {
          setVerifiedPayments((prev) => ({ ...prev, [tutee.id]: verified }));
        })
      );
      unsubAttendance.push(
        paymentService.subscribeAttendanceByTutee(tutorId, tutee.id, (att) => {
          setAttendance((prev) => ({ ...prev, [tutee.id]: att }));
        })
      );
    });

    setLoading(false);

    return () => {
      unsubAnnouncements();
      unsubAssessments();
      unsubPayments.forEach((unsub) => unsub());
      unsubAttendance.forEach((unsub) => unsub());
    };
  }, [tutorId, tutees]);

  useEffect(() => {
    const cleanup = loadData();
    return cleanup;
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  if (tuteesLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!tutees.length) {
    return (
      <View style={styles.screen}>
        <Text style={styles.headerTitle}>Parent Dashboard</Text>
        <EmptyState
          icon="account-child-outline"
          title="No Children Linked"
          message="You don't have any children linked to your account yet. Contact your tutor to get started."
        />
      </View>
    );
  }

  // Total Paid = tutor cash records (paymentTransactions) + verified parent proof payments (payments)
  const totalPaid = Math.round(tutees.reduce((sum, tutee) =>
    sum + (payments[tutee.id] || 0) + (verifiedPayments[tutee.id] || 0), 0));

  const totalOutstanding = Math.round(tutees.reduce((sum, tutee) => {
    const paid = (payments[tutee.id] || 0) + (verifiedPayments[tutee.id] || 0);
    const due = (tutee.totalSessions || 0) * (tutee.ratePerSession || 0);
    return sum + Math.max(due - paid, 0);
  }, 0));

  let totalAttended = 0;
  let totalSessions = 0;
  Object.values(attendance).forEach((att) => {
    totalAttended += att.presentCount;
    totalSessions += att.totalSessions;
  });
  const attendanceRate = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 100;

  const hasAttendance = tutees.some((t) => (attendance[t.id]?.totalSessions || 0) > 0);

  const latestAnnouncement = announcements.length > 0 ? announcements[0] : null;

  const recentAssessments = [...assessments]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  const monthlyScores: Record<string, Record<string, number[]>> = {};
  tutees.forEach((tutee) => {
    monthlyScores[tutee.id] = {};
  });
  assessments.forEach((a) => {
    if (!monthlyScores[a.tuteeId]) return;
    const month = new Date(a.date).toLocaleString('default', { month: 'short' });
    if (!monthlyScores[a.tuteeId][month]) {
      monthlyScores[a.tuteeId][month] = [];
    }
    monthlyScores[a.tuteeId][month].push(a.score || 0);
  });

  const months = Array.from(
    new Set(assessments.map((a) => new Date(a.date).toLocaleString('default', { month: 'short' })))
  ).slice(-6);

  const subjectTotals: Record<string, { sum: number; count: number }> = {};
  assessments.forEach((a) => {
    const subject = a.subject || 'General';
    if (!subjectTotals[subject]) subjectTotals[subject] = { sum: 0, count: 0 };
    subjectTotals[subject].sum += a.score || 0;
    subjectTotals[subject].count += 1;
  });

  const subjectLabels = Object.keys(subjectTotals).slice(0, 3);

  const allSchedule: any[] = [];
  tutees.forEach((tutee) => {
    if (tutee.schedule && Array.isArray(tutee.schedule)) {
      tutee.schedule.forEach((s: any) => {
        allSchedule.push({ ...s, tuteeName: tutee.firstName || 'Child' });
      });
    }
  });
  const sortedSchedule = allSchedule.sort((a, b) => {
    const aIdx = dayOrder.indexOf(a.day);
    const bIdx = dayOrder.indexOf(b.day);
    return (aIdx === -1 ? 7 : aIdx) - (bIdx === -1 ? 7 : bIdx);
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 16, paddingBottom: tabBarHeight }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
    >
      <Text style={styles.headerTitle}>Parent Dashboard</Text>

      {latestAnnouncement && (
        <ScaleOnPress
          onPress={() => router.push(`/(main)/announcements/${latestAnnouncement.id}`)}
          entering={FadeInDown.duration(200)}
        >
          <Card style={styles.announcementCard}>
            <Card.Content>
              <View style={styles.announcementHeader}>
                <MaterialCommunityIcons name="bullhorn-outline" size={20} color="#92400e" />
                <Text style={styles.announcementTitle}>Latest Announcement</Text>
              </View>
              <Text style={styles.announcementSubject}>{latestAnnouncement.title}</Text>
              <Text style={styles.announcementBody} numberOfLines={3}>
                {latestAnnouncement.content}
              </Text>
            </Card.Content>
          </Card>
        </ScaleOnPress>
      )}

      <View style={styles.kpiGrid}>
        <Animated.View style={styles.kpiItem} entering={FadeInDown.duration(200)}>
          <KpiCard
            title="Linked Children"
            value={tutees.length.toString()}
            icon="account-child-outline"
            color="#2563eb"
            bgColor="#dbeafe"
          />
        </Animated.View>
        <Animated.View style={styles.kpiItem} entering={FadeInDown.delay(60).duration(200)}>
          <KpiCard
            title="Total Paid"
            value={formatCurrency(totalPaid)}
            icon="cash-check"
            color="#2563eb"
            bgColor="#dbeafe"
          />
        </Animated.View>
        <Animated.View style={styles.kpiItem} entering={FadeInDown.delay(60).duration(200)}>
          <KpiCard
            title="Outstanding"
            value={formatCurrency(totalOutstanding)}
            icon="cash-remove"
            color="#dc2626"
            bgColor="#fef2f2"
          />
        </Animated.View>
        <Animated.View style={styles.kpiItem} entering={FadeInDown.delay(120).duration(200)}>
          <KpiCard
            title="Attendance"
            value={`${attendanceRate}%`}
            icon="check-circle-outline"
            color="#2563eb"
            bgColor="#dbeafe"
          />
        </Animated.View>
      </View>

      {assessments.length > 0 && (
        <>
          <SectionHeader title="Monthly Scores" onSeeAll={() => router.push('/(main)/assessments')} />
          <Animated.View entering={FadeInDown.duration(250)}>
            <Card style={styles.chartCard}>
              <Card.Content>
                <View style={styles.vBarChart}>
                <View style={styles.vBarChartArea}>
                  {months.map((month, mIdx) => (
                    <View key={month} style={styles.vBarGroup}>
                      <View style={styles.vBarGroupBars}>
        {tutees.slice(0, 3).map((tutee, tIdx) => {
          const scores = monthlyScores[tutee.id]?.[month] || [];
          const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          const height = Math.max((avg / 100) * 140, avg > 0 ? 4 : 0);
          return (
            <AnimatedBar
              key={tutee.id}
              axis="vertical"
              height={height}
              backgroundColor={CHART_COLORS[tIdx % CHART_COLORS.length]}
              style={styles.vBar}
              delay={mIdx * 80 + tIdx * 60}
            />
          );
        })}
                      </View>
                      <Text style={styles.vBarLabel}>{month}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.vBarLegend}>
                  {tutees.slice(0, 3).map((t, tIdx) => (
                    <View key={t.id} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: CHART_COLORS[tIdx % CHART_COLORS.length] }]} />
                      <Text style={styles.legendText}>{t.firstName || 'Child'}</Text>
                    </View>
                  ))}
                </View>
              </View>
              </Card.Content>
            </Card>
          </Animated.View>
        </>
      )}

      {subjectLabels.length > 0 && (
        <>
          <SectionHeader title="Subject Averages" onSeeAll={() => router.push('/(main)/assessments')} />
          <Animated.View entering={FadeInDown.duration(250)}>
            <Card style={styles.chartCard}>
              <Card.Content>
                <View style={styles.hBarChart}>
                  {subjectLabels.map((subject, idx) => {
                    const avg = Math.round(subjectTotals[subject].sum / subjectTotals[subject].count);
                    return (
                      <View key={subject} style={styles.hBarRow}>
                        <Text style={styles.hBarLabel}>{subject.length > 10 ? subject.slice(0, 10) + '...' : subject}</Text>
                        <View style={styles.hBarTrack}>
                          <AnimatedBar
                            axis="horizontal"
                            width={`${Math.max(avg, 2)}%`}
                            backgroundColor={avg >= 70 ? '#2563eb' : avg >= 50 ? '#f59e0b' : '#dc2626'}
                            style={styles.hBarFill}
                            delay={idx * 80}
                          />
                        </View>
                        <Text style={styles.hBarValue}>{avg}%</Text>
                      </View>
                    );
                  })}
                </View>
              </Card.Content>
            </Card>
          </Animated.View>
        </>
      )}

      <SectionHeader title="Recent Assessments" onSeeAll={() => router.push('/(main)/assessments')} />
      {recentAssessments.length === 0 ? (
        <Card style={styles.card}>
          <Card.Content>
            <EmptyState
              icon="file-document-outline"
              title="No Assessments"
              message="No assessment records available yet."
            />
          </Card.Content>
        </Card>
      ) : (
        recentAssessments.map((a, idx) => {
          const tutee = tutees.find((t) => t.id === a.tuteeId);
          return (
            <Animated.View key={a.id} entering={FadeInDown.delay(idx * 40).duration(200)}>
              <Card style={styles.listCard}>
                <Card.Content style={styles.listRow}>
                  <MaterialCommunityIcons name="school-outline" size={20} color="#2563eb" />
                  <View style={styles.listTextContainer}>
                    <Text style={styles.listPrimary}>
                      {a.subject || 'General'} - {tutee?.firstName || 'Child'}
                    </Text>
                    <Text style={styles.listSecondary}>
                      {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Score: {a.score}%
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            </Animated.View>
          );
        })
      )}

      <SectionHeader title="Weekly Schedule" onSeeAll={() => router.push('/(main)/schedule')} />
      {sortedSchedule.length === 0 ? (
        <Card style={styles.card}>
          <Card.Content>
            <EmptyState
              icon="calendar-blank-outline"
              title="No Schedule"
              message="No tutoring sessions have been scheduled."
            />
          </Card.Content>
        </Card>
      ) : (
        sortedSchedule.slice(0, 3).map((s, idx) => (
          <Animated.View key={idx} entering={FadeInDown.delay(idx * 40).duration(200)}>
            <Card style={styles.listCard}>
              <Card.Content style={styles.listRow}>
                <MaterialCommunityIcons name="calendar-clock-outline" size={20} color="#2563eb" />
                <View style={styles.listTextContainer}>
                  <Text style={styles.listPrimary}>
                    {s.tuteeName} - {s.subject || 'Session'}
                  </Text>
                  <Text style={styles.listSecondary}>
                    {s.day} · {formatTime12h(s.time)}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          </Animated.View>
        ))
      )}

      <SectionHeader title="Attendance" onSeeAll={() => router.push('/(main)/attendance')} />
      {!hasAttendance ? (
        <Card style={styles.card}>
          <Card.Content>
            <EmptyState
              icon="calendar-check-outline"
              title="No Attendance"
              message="No attendance records available yet."
            />
          </Card.Content>
        </Card>
      ) : (
        tutees.slice(0, 3).map((tutee, idx) => {
          const att = attendance[tutee.id] || { presentCount: 0, totalSessions: 0 };
          const rate = att.totalSessions > 0 ? Math.round((att.presentCount / att.totalSessions) * 100) : 100;
          return (
            <Animated.View key={tutee.id} entering={FadeInDown.delay(idx * 40).duration(200)}>
              <Card style={styles.listCard}>
                <Card.Content style={styles.listRow}>
                  <MaterialCommunityIcons name="calendar-check-outline" size={20} color="#2563eb" />
                  <View style={styles.listTextContainer}>
                    <Text style={styles.listPrimary}>{tutee.firstName} {tutee.surname}</Text>
                    <Text style={styles.listSecondary}>{att.presentCount} of {att.totalSessions} sessions attended</Text>
                  </View>
                  <View style={[styles.dashAttBadge, { backgroundColor: rate >= 80 ? '#dbeafe' : rate >= 50 ? '#fef3c7' : '#fef2f2' }]}>
                    <Text style={[styles.dashAttRate, { color: rate >= 80 ? '#2563eb' : rate >= 50 ? '#d97706' : '#dc2626' }]}>
                      {rate}%
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            </Animated.View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eff6ff',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 110,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 16,
    marginTop: 8,
  },
  announcementCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 16,
    marginBottom: 16,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
    marginLeft: 8,
  },
  announcementSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#78350f',
    marginBottom: 4,
  },
  announcementBody: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kpiItem: {
    width: '48%',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
    marginTop: 16,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 8,
    elevation: 2,
  },
  vBarChart: {
    paddingVertical: 8,
  },
  vBarChartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 170,
    paddingBottom: 4,
  },
  vBarGroup: {
    alignItems: 'center',
    flex: 1,
  },
  vBarGroupBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 140,
  },
  vBar: {
    width: 14,
    borderRadius: 4,
    minHeight: 0,
  },
  vBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 6,
  },
  vBarLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#374151',
  },
  hBarChart: {
    gap: 12,
    paddingVertical: 4,
  },
  hBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hBarLabel: {
    width: 80,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'right',
  },
  hBarTrack: {
    flex: 1,
    height: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    overflow: 'hidden',
  },
  hBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  hBarValue: {
    width: 36,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 8,
    elevation: 2,
  },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  listPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  listSecondary: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  dashAttBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginLeft: 8,
  },
  dashAttRate: {
    fontSize: 14,
    fontWeight: '800',
  },
});
