import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/hooks/useAuth';
import { useTutees } from '../../../src/hooks/useTutees';
import { useTabBarHeight } from '../../../src/hooks/useTabBarHeight';
import { useSchoolYear } from '../../../src/contexts/SchoolYearContext';
import { paymentService, MonthlyRecord, getDayAttendance } from '../../../src/services/paymentService';
import { assessmentService } from '../../../src/services/assessmentService';
import { ChildCard } from '../../../src/components/ChildCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { router } from 'expo-router';
import { Tutee } from '../../../src/types/tutee';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { getTuteeYearTotals, belongsToSchoolYear, isMonthInSchoolYear } from '../../../src/utils/schoolYear';

export default function MyChildrenScreen() {
  const { user } = useAuth();
  const { tutees, isLoading: tuteesLoading } = useTutees();
  const { selectedYear } = useSchoolYear();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const [recordsMap, setRecordsMap] = useState<Record<string, MonthlyRecord[]>>({});
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
      setRecordsMap({});
      setMetricsMap({});
      return;
    }

    const cleanups: (() => void)[] = [];
    const tutorId = user.createdByTutorId;

    tutees.forEach((tutee) => {
      const unsubRecords = paymentService.subscribeRecordsByTutee(tutorId, tutee.id, (recs) => {
        setRecordsMap((prev) => ({ ...prev, [tutee.id]: recs }));
      });
      cleanups.push(unsubRecords);
    });

    const tuteeIds = tutees.map((t) => t.id);
    const unsubAssess = assessmentService.subscribeAll(tutorId, tuteeIds, (assessments) => {
      const avgByTutee: Record<string, { sum: number; count: number }> = {};
      tuteeIds.forEach((id) => { avgByTutee[id] = { sum: 0, count: 0 }; });
      assessments
        .filter((a) => belongsToSchoolYear(selectedYear, a))
        .forEach((a) => {
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
  }, [user?.createdByTutorId, tutees, selectedYear]);

  // Derive per-child financial + attendance metrics for the selected school year.
  const computedMetrics = useMemo(() => {
    const map: Record<string, {
      attendanceRate: number;
      averageScore: number;
      totalPaid: number;
      balance: number;
      paymentStatus: string;
    }> = {};

    tutees.forEach((tutee) => {
      const yearTotals = getTuteeYearTotals(tutee, selectedYear);
      const totalPaid = Math.round(yearTotals.totalPaid || 0);
      const balance = Math.max(Math.round(yearTotals.balance || 0), 0);

      const recs = (recordsMap[tutee.id] || []).filter((r) => isMonthInSchoolYear(r.month, selectedYear));
      let present = 0;
      let total = 0;
      recs.forEach((r) => {
        (r.dayPayments || []).forEach((dp) => {
          const att = getDayAttendance(dp);
          if (att === 'present') present++;
          if (att !== 'no-class') total++;
        });
      });
      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : -1;

      const paymentStatus =
        totalPaid > 0 && balance === 0 ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Unpaid';

      map[tutee.id] = {
        attendanceRate,
        averageScore: metricsMap[tutee.id]?.averageScore ?? 0,
        totalPaid,
        balance,
        paymentStatus,
      };
    });

    return map;
  }, [tutees, recordsMap, metricsMap, selectedYear]);

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
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <MaterialCommunityIcons name="account-group-outline" size={28} color="#2563eb" />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>My Children</Text>
          <Text style={styles.headerSubtitle}>View details for each of your linked children</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: tabBarHeight }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563eb']} />
        }
      >

      {tutees.length === 0 ? (
        <EmptyState
          icon="account-group-outline"
          title="No linked children yet"
          message="Contact your tutor to link your children's accounts"
        />
      ) : (
        tutees.map((tutee, index) => {
          const metrics = computedMetrics[tutee.id] || {
            attendanceRate: -1,
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff6ff',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#eff6ff',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerText: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
});
