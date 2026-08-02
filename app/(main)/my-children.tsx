import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/hooks/useAuth';
import { useTutees } from '../../src/hooks/useTutees';
import { useTabBarHeight } from '../../src/hooks/useTabBarHeight';
import { paymentService } from '../../src/services/paymentService';
import { assessmentService } from '../../src/services/assessmentService';
import { ChildCard } from '../../src/components/ChildCard';
import { EmptyState } from '../../src/components/EmptyState';
import { router } from 'expo-router';
import { Tutee } from '../../src/types/tutee';

export default function MyChildrenScreen() {
  const { user } = useAuth();
  const { tutees, isLoading: tuteesLoading } = useTutees();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const [metricsMap, setMetricsMap] = useState<Record<string, {
    attendanceRate: number;
    averageScore: number;
    totalPaid: number;
    balance: number;
    paymentStatus: string;
  }>>({});
  const [refreshing, setRefreshing] = useState(false);
  const pendingRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user?.createdByTutorId || tutees.length === 0) {
      setMetricsMap({});
      return;
    }

    const cleanups: (() => void)[] = [];
    const tutorId = user.createdByTutorId;

    tutees.forEach((tutee) => {
      let totalPaid = 0;

      const unsubTxn = paymentService.subscribeTransactionsByTutee(tutorId, tutee.id, (paid) => {
        totalPaid = paid;
        const pending = pendingRef.current[tutee.id] || 0;
        const effectivePaid = paid + pending;
        const totalDue = (tutee.totalSessions || 0) * (tutee.ratePerSession || 0);
        const balance = Math.max(totalDue - effectivePaid, 0);
        const paymentStatus = effectivePaid > 0 && balance === 0 ? 'Paid' : effectivePaid > 0 ? 'Partial' : 'Unpaid';

        setMetricsMap((prev) => ({
          ...prev,
          [tutee.id]: {
            ...prev[tutee.id],
            totalPaid: effectivePaid,
            balance,
            paymentStatus,
          },
        }));
      });
      cleanups.push(unsubTxn);

      const unsubPending = paymentService.subscribePendingAmountByTutee(tutorId, tutee.id, (pending) => {
        pendingRef.current[tutee.id] = pending;
        const effectivePaid = totalPaid + pending;
        const totalDue = (tutee.totalSessions || 0) * (tutee.ratePerSession || 0);
        const balance = Math.max(totalDue - effectivePaid, 0);
        const paymentStatus = effectivePaid > 0 && balance === 0 ? 'Paid' : effectivePaid > 0 ? 'Partial' : 'Unpaid';

        setMetricsMap((prev) => ({
          ...prev,
          [tutee.id]: {
            ...prev[tutee.id],
            totalPaid: effectivePaid,
            balance,
            paymentStatus,
          },
        }));
      });
      cleanups.push(unsubPending);

      const unsubAtt = paymentService.subscribeAttendanceByTutee(tutorId, tutee.id, (att) => {
        const rate = att.totalSessions > 0 ? Math.round((att.presentCount / att.totalSessions) * 100) : 100;
        setMetricsMap((prev) => ({
          ...prev,
          [tutee.id]: {
            ...prev[tutee.id],
            attendanceRate: rate,
          },
        }));
      });
      cleanups.push(unsubAtt);
    });

    const tuteeIds = tutees.map((t) => t.id);
    const unsubAssess = assessmentService.subscribeAll(tutorId, tuteeIds, (assessments) => {
      const avgByTutee: Record<string, { sum: number; count: number }> = {};
      tuteeIds.forEach((id) => { avgByTutee[id] = { sum: 0, count: 0 }; });
      assessments.forEach((a) => {
        if (typeof a.score === 'number' && avgByTutee[a.tuteeId]) {
          avgByTutee[a.tuteeId].sum += a.score;
          avgByTutee[a.tuteeId].count += 1;
        }
      });
      Object.entries(avgByTutee).forEach(([id, stats]) => {
        const avg = stats.count > 0 ? Math.round(stats.sum / stats.count) : 0;
        setMetricsMap((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            averageScore: avg,
          },
        }));
      });
    });
    cleanups.push(unsubAssess);

    return () => cleanups.forEach((unsub) => unsub());
  }, [user?.createdByTutorId, tutees]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (tuteesLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#15803d" />
        <Text style={styles.loadingText}>Loading children listing...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 16, paddingBottom: tabBarHeight }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#15803d']} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Children</Text>
        <Text style={styles.headerSubtitle}>View details for each of your linked children</Text>
      </View>

      {tutees.length === 0 ? (
        <EmptyState
          icon="account-group-outline"
          title="No linked children yet"
          message="Contact your tutor to link your children's accounts"
        />
      ) : (
        tutees.map((tutee) => {
          const metrics = metricsMap[tutee.id] || {
            attendanceRate: 100,
            averageScore: 0,
            totalPaid: 0,
            balance: 0,
            paymentStatus: 'Unpaid',
          };

          return (
            <ChildCard
              key={tutee.id}
              tutee={tutee}
              metrics={metrics}
              onPress={() => router.push(`/(main)/children/${tutee.id}`)}
            />
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
});
