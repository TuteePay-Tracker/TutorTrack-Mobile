import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useTabBarHeight } from '../../src/hooks/useTabBarHeight';
import { useAuth } from '../../src/hooks/useAuth';
import { useTutees } from '../../src/hooks/useTutees';
import { paymentService } from '../../src/services/paymentService';
import { EmptyState } from '../../src/components/EmptyState';

export default function AttendanceScreen() {
  const { user } = useAuth();
  const { tutees, isLoading } = useTutees();
  const tabBarHeight = useTabBarHeight();
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { presentCount: number; totalSessions: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.createdByTutorId || tutees.length === 0) {
      setLoading(false);
      return;
    }
    const tutorId = user.createdByTutorId;

    const cleanups: (() => void)[] = [];
    tutees.forEach((tutee) => {
      const unsub = paymentService.subscribeAttendanceByTutee(tutorId, tutee.id, (att) => {
        setAttendanceMap((prev) => ({ ...prev, [tutee.id]: att }));
        setLoading(false);
      });
      cleanups.push(unsub);
    });

    return () => cleanups.forEach((u) => u());
  }, [user?.createdByTutorId, tutees]);

  if (isLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#15803d" />
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
      <Stack.Screen options={{ headerShown: true, title: 'Attendance', headerTintColor: '#15803d' }} />
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

        {tutees.length === 0 ? (
          <EmptyState
            icon="account-group-outline"
            title="No Children"
            message="No children linked to your account yet."
          />
        ) : (
          tutees.map((tutee) => {
            const att = attendanceMap[tutee.id] || { presentCount: 0, totalSessions: 0 };
            const rate = att.totalSessions > 0 ? Math.round((att.presentCount / att.totalSessions) * 100) : 100;

            return (
              <Card key={tutee.id} style={styles.card}>
                <Card.Content style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.childName}>{tutee.firstName} {tutee.surname}</Text>
                    <Text style={styles.sessionInfo}>
                      {att.presentCount} of {att.totalSessions} sessions attended
                    </Text>
                  </View>
                  <View style={[styles.rateBadge, { backgroundColor: rate >= 80 ? '#dcfce7' : rate >= 50 ? '#fef3c7' : '#fef2f2' }]}>
                    <Text style={[styles.rateText, { color: rate >= 80 ? '#15803d' : rate >= 50 ? '#d97706' : '#dc2626' }]}>
                      {rate}%
                    </Text>
                  </View>
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
  summaryCard: { marginBottom: 16, borderRadius: 16, elevation: 2, backgroundColor: '#15803d' },
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
});
