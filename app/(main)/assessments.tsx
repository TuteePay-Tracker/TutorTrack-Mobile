import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useTabBarHeight } from '../../src/hooks/useTabBarHeight';
import { useAuth } from '../../src/hooks/useAuth';
import { useTutees } from '../../src/hooks/useTutees';
import { assessmentService } from '../../src/services/assessmentService';
import { Assessment } from '../../src/types/assessment';
import { formatDate } from '../../src/utils/formatDate';
import { EmptyState } from '../../src/components/EmptyState';

export default function AssessmentsScreen() {
  const { user } = useAuth();
  const { tutees } = useTutees();
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.createdByTutorId || tutees.length === 0) return;

    const tuteeIds = tutees.map((t) => t.id);
    const unsub = assessmentService.subscribeAll(user.createdByTutorId, tuteeIds, (data) => {
      setAssessments(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
    });

    return () => unsub();
  }, [user?.createdByTutorId, tutees]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: '',
        headerTintColor: '#15803d',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#f9fafb' },
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#15803d" />
          </TouchableOpacity>
        ),
      }} />
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}>
        {assessments.length === 0 ? (
          <EmptyState
            icon="file-document-outline"
            title="No Assessments"
            message="No assessment records available yet."
          />
        ) : (
          assessments.map((a) => {
            const tutee = tutees.find((t) => t.id === a.tuteeId);
            return (
              <Card key={a.id} style={styles.card}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.subject}>{a.subject || 'General'}</Text>
                      <Text style={styles.childName}>{tutee ? `${tutee.firstName} ${tutee.surname}` : 'Unknown'}</Text>
                    </View>
                    <View style={styles.scoreBadge}>
                      <Text style={styles.score}>{a.score}%</Text>
                    </View>
                  </View>
                  {a.topic && <Text style={styles.topic}>{a.topic}</Text>}
                  <View style={styles.cardFooter}>
                    <Text style={styles.date}>{formatDate(a.date)}</Text>
                    {a.remarks && (
                      <Text style={[styles.remarks, {
                        color: a.remarks === 'Excellent' ? '#059669' : a.remarks === 'Good' ? '#3b82f6' : '#ea580c'
                      }]}>
                        {a.remarks}
                      </Text>
                    )}
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
  card: { marginBottom: 10, borderRadius: 14, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flex: 1 },
  subject: { fontSize: 16, fontWeight: '700', color: '#111827' },
  childName: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  scoreBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  score: { fontSize: 16, fontWeight: '800', color: '#15803d' },
  topic: { fontSize: 13, color: '#6b7280', marginTop: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  date: { fontSize: 12, color: '#9ca3af' },
  remarks: { fontSize: 12, fontWeight: '700' },
});
