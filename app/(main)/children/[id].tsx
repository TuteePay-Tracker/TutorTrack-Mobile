import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Avatar, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useTabBarHeight } from '../../../src/hooks/useTabBarHeight';
import { useAuth } from '../../../src/hooks/useAuth';
import { tuteeService } from '../../../src/services/tuteeService';
import { paymentService, PaymentTransaction } from '../../../src/services/paymentService';
import { assessmentService } from '../../../src/services/assessmentService';
import { Tutee } from '../../../src/types/tutee';
import { Assessment } from '../../../src/types/assessment';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { formatDate } from '../../../src/utils/formatDate';
import { formatTime12h } from '../../../src/utils/formatTime';

export default function ChildDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const tabBarHeight = useTabBarHeight();
  const [tutee, setTutee] = useState<Tutee | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user?.createdByTutorId) return;

    let unsubs: (() => void)[] = [];
    const tutorId = user.createdByTutorId;

    const fetchData = async () => {
      try {
        setLoading(true);
        const tuteeData = await tuteeService.getById(id, tutorId);
        setTutee(tuteeData);

        const unsubTxn = paymentService.subscribeTransactionsByTuteeList(tutorId, id, (data) => {
          setTransactions(data);
        });
        unsubs.push(unsubTxn);

        const unsubAssess = assessmentService.subscribeByTutee(tutorId, id, (data) => {
          setAssessments(data);
        });
        unsubs.push(unsubAssess);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching child details:', error);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [id, user?.createdByTutorId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#15803d" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  if (!tutee) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Student not found</Text>
      </View>
    );
  }

  const subjects = tutee.subjects?.length ? tutee.subjects : [tutee.subject];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `${tutee.firstName} ${tutee.surname}`,
          headerTintColor: '#15803d',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}>
        <Card style={styles.profileCard}>
          <Card.Content style={styles.profileContent}>
            {tutee.photoUrl ? (
              <Avatar.Image size={64} source={{ uri: tutee.photoUrl }} />
            ) : (
              <Avatar.Text
                size={64}
                label={`${tutee.firstName.charAt(0)}${tutee.surname.charAt(0)}`}
                style={styles.avatarFallback}
                labelStyle={{ fontSize: 22, fontWeight: '700' }}
              />
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{tutee.firstName} {tutee.surname}</Text>
              {tutee.gradeLevel && <Text style={styles.grade}>{tutee.gradeLevel}</Text>}
              <View style={styles.subjectRow}>
                {subjects.map((s) => (
                  <View key={s} style={styles.subjectBadge}>
                    <Text style={styles.subjectText}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Card.Content>
        </Card>

        {Array.isArray(tutee.schedule) && tutee.schedule.length > 0 && (
          <Card style={styles.sectionCard}>
            <Card.Content>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => router.push(`/(main)/schedule?from=children/${id}`)} activeOpacity={0.7}>
                <MaterialCommunityIcons name="calendar-outline" size={18} color="#15803d" />
                <Text style={styles.sectionTitle}>Schedule</Text>
                <View style={styles.seeAllRow}>
                  <Text style={styles.seeAllText}>See All</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#15803d" />
                </View>
              </TouchableOpacity>
              {tutee.schedule.map((slot, index) => {
                if (typeof slot === 'object' && slot !== null && 'startTime' in slot && 'endTime' in slot) {
                  return (
                    <View key={index} style={styles.scheduleItem}>
                      <Text style={styles.scheduleDay}>{slot.day}</Text>
                      <Text style={styles.scheduleTime}>
                        {formatTime12h(slot.startTime || '')} - {formatTime12h(slot.endTime || '')}
                      </Text>
                    </View>
                  );
                }
                return null;
              })}
            </Card.Content>
          </Card>
        )}

        <Card style={styles.sectionCard}>
          <Card.Content>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => router.push(`/(main)/payments?from=children/${id}`)} activeOpacity={0.7}>
              <MaterialCommunityIcons name="credit-card-outline" size={18} color="#15803d" />
              <Text style={styles.sectionTitle}>Payment History</Text>
              <View style={styles.seeAllRow}>
                <Text style={styles.seeAllText}>See All</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#15803d" />
              </View>
            </TouchableOpacity>
            {transactions.length === 0 ? (
              <Text style={styles.emptyText}>No payment records yet</Text>
            ) : (
              transactions.map((txn) => (
                <View key={txn.id} style={styles.transactionItem}>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionAmount}>{formatCurrency(txn.totalAmount)}</Text>
                    <Text style={styles.transactionMethod}>{txn.paymentMethod}</Text>
                  </View>
                  <Text style={styles.transactionDate}>{formatDate(txn.paymentDate)}</Text>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => router.push(`/(main)/assessments?from=children/${id}`)} activeOpacity={0.7}>
              <MaterialCommunityIcons name="chart-line" size={18} color="#15803d" />
              <Text style={styles.sectionTitle}>Assessments</Text>
              <View style={styles.seeAllRow}>
                <Text style={styles.seeAllText}>See All</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#15803d" />
              </View>
            </TouchableOpacity>
            {assessments.length === 0 ? (
              <Text style={styles.emptyText}>No assessment records yet</Text>
            ) : (
              assessments.map((a) => (
                <View key={a.id} style={styles.assessmentItem}>
                  <View style={styles.assessmentInfo}>
                    <Text style={styles.assessmentSubject}>{a.subject}</Text>
                    <Text style={styles.assessmentTopic}>{a.topic}</Text>
                  </View>
                  <View style={styles.assessmentRight}>
                    <Text style={styles.assessmentScore}>{a.score}%</Text>
                    <Text style={[styles.assessmentRemarks, {
                      color: a.remarks === 'Excellent' ? '#059669' : a.remarks === 'Good' ? '#3b82f6' : '#ea580c'
                    }]}>
                      {a.remarks}
                    </Text>
                    <Text style={styles.assessmentDate}>{formatDate(a.date)}</Text>
                  </View>
                </View>
              ))
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
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
  profileCard: {
    borderRadius: 16,
    marginBottom: 16,
    elevation: 1,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarFallback: {
    backgroundColor: '#15803d',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  grade: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  subjectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 6,
  },
  subjectBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  subjectText: {
    fontSize: 12,
    color: '#15803d',
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: 16,
    marginBottom: 16,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803d',
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  scheduleDay: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  scheduleTime: {
    fontSize: 14,
    color: '#6b7280',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  transactionMethod: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  assessmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  assessmentInfo: {
    flex: 1,
  },
  assessmentSubject: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  assessmentTopic: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  assessmentRight: {
    alignItems: 'flex-end',
  },
  assessmentScore: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  assessmentRemarks: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  assessmentDate: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
