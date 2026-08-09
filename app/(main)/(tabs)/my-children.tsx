import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/hooks/useAuth';
import { useTutees } from '../../../src/hooks/useTutees';
import { useTabBarHeight } from '../../../src/hooks/useTabBarHeight';
import { paymentService } from '../../../src/services/paymentService';
import { assessmentService } from '../../../src/services/assessmentService';
import { ChildCard } from '../../../src/components/ChildCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { router } from 'expo-router';
import { Tutee } from '../../../src/types/tutee';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

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

  useEffect(() => {
    if (!user?.createdByTutorId || tutees.length === 0) {
      setMetricsMap({});
      return;
    }

    const cleanups: (() => void)[] = [];
    const tutorId = user.createdByTutorId;

    tutees.forEach((tutee) => {
      // Use local refs so both callbacks can see each other's latest value
      let txnPaid = 0;
      let verifiedPaid = 0;

      const updateMetrics = () => {
        const combined = txnPaid + verifiedPaid;
        const totalDue = (tutee.totalSessions || 0) * (tutee.ratePerSession || 0);
        const balance = Math.max(totalDue - combined, 0);
        const paymentStatus = combined > 0 && balance === 0 ? 'Paid' : combined > 0 ? 'Partial' : 'Unpaid';
        setMetricsMap((prev) => ({
          ...prev,
          [tutee.id]: {
            ...prev[tutee.id],
            totalPaid: combined,
            balance,
            paymentStatus,
          },
        }));
      };

      const unsubTxn = paymentService.subscribeTransactionsByTutee(tutorId, tutee.id, (paid) => {
        txnPaid = paid;
        updateMetrics();
      });
      cleanups.push(unsubTxn);

      const unsubVerified = paymentService.subscribeVerifiedAmountByTutee(tutorId, tutee.id, (verified) => {
        verifiedPaid = verified;
        updateMetrics();
      });
      cleanups.push(unsubVerified);

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
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading children listing...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 16, paddingBottom: tabBarHeight }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563eb']} />
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
        tutees.map((tutee, index) => {
          const metrics = metricsMap[tutee.id] || {
            attendanceRate: 100,
            averageScore: 0,
            totalPaid: 0,
            balance: 0,
            paymentStatus: 'Unpaid',
          };

          return (
            <Animated.View
              key={tutee.id}
              entering={FadeInDown.delay(index * 50).duration(200)}
              layout={LinearTransition.duration(200)}
            >
              <ChildCard
                tutee={tutee}
                metrics={metrics}
                onPress={() => router.push(`/(main)/children/${tutee.id}`)}
              />
            </Animated.View>
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
