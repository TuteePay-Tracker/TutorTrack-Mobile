import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import { Text, Card, Avatar, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useTabBarHeight } from '../../../src/hooks/useTabBarHeight';
import { useAuth } from '../../../src/hooks/useAuth';
import { useSchoolYear } from '../../../src/contexts/SchoolYearContext';
import { tuteeService } from '../../../src/services/tuteeService';
import { paymentService, PaymentTransaction, MonthlyRecord, MakeUpCredit, getDayAttendance } from '../../../src/services/paymentService';
import { Payment } from '../../../src/types/payment';
import { assessmentService } from '../../../src/services/assessmentService';
import { topicService, Topic, StudentTopicProgress, LEVEL_CONFIG } from '../../../src/services/topicService';
import { Tutee } from '../../../src/types/tutee';
import { Assessment } from '../../../src/types/assessment';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { formatDate } from '../../../src/utils/formatDate';
import { formatTime12h } from '../../../src/utils/formatTime';
import { getTuteeYearTotals, belongsToSchoolYear, isMonthInSchoolYear } from '../../../src/utils/schoolYear';
import { compareScheduleSlots } from '../../../src/utils/scheduleSort';

type MergedTxn = {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  notes?: string;
  status?: 'pending' | 'verified' | 'rejected';
  proofUrl?: string;
  source: 'transaction' | 'payment';
};

const STATUS_CONFIG = {
  pending: { color: '#f59e0b', bg: '#fffbeb', label: 'Pending' },
  verified: { color: '#059669', bg: '#f0fdf4', label: 'Verified' },
  rejected: { color: '#dc2626', bg: '#fef2f2', label: 'Rejected' },
};

export default function ChildDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { selectedYear } = useSchoolYear();
  const router = useRouter();
  const tabBarHeight = useTabBarHeight();
  const [tutee, setTutee] = useState<Tutee | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicProgress, setTopicProgress] = useState<StudentTopicProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [proofViewerUrl, setProofViewerUrl] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<{ presentCount: number; totalSessions: number }>({ presentCount: 0, totalSessions: 0 });
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyRecord[]>([]);
  const [makeUpCredits, setMakeUpCredits] = useState<MakeUpCredit[]>([]);
  const [activeTopicSubject, setActiveTopicSubject] = useState<string>('');

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
          setTransactions(data.filter((t) => belongsToSchoolYear(selectedYear, t)));
        });
        unsubs.push(unsubTxn);

        const unsubPayments = paymentService.subscribePaymentsByTutee(tutorId, id, (data) => {
          setPayments(data.filter((p) => belongsToSchoolYear(selectedYear, p)));
        });
        unsubs.push(unsubPayments);

        const unsubAssess = assessmentService.subscribeByTutee(tutorId, id, (data) => {
          setAssessments(data.filter((a) => belongsToSchoolYear(selectedYear, a)));
        });
        unsubs.push(unsubAssess);

        const unsubRecords = paymentService.subscribeRecordsByTutee(tutorId, id, (recs) => {
          const filtered = recs.filter((r) => isMonthInSchoolYear(r.month, selectedYear));
          let present = 0;
          let total = 0;
          filtered.forEach((r) => {
            (r.dayPayments || []).forEach((dp) => {
              const att = getDayAttendance(dp);
              if (att === 'present') present++;
              if (att !== 'no-class') total++;
            });
          });
          setMonthlyRecords(filtered);
          setAttendance({ presentCount: present, totalSessions: total });
        });
        unsubs.push(unsubRecords);

        const unsubCredits = paymentService.subscribeMakeUpCreditsByTutee(
          tutorId,
          id,
          (credits) => {
            setMakeUpCredits(
              credits.filter(
                (credit) =>
                  isMonthInSchoolYear(credit.sourceMonth, selectedYear) ||
                  (credit.targetMonth && isMonthInSchoolYear(credit.targetMonth, selectedYear))
              )
            );
          }
        );
        unsubs.push(unsubCredits);

        // Subscribe to topic data
        const unsubTopics = topicService.subscribeTopics(tutorId, (data) => {
          setTopics(data);
        });
        unsubs.push(unsubTopics);

        const unsubProgress = topicService.subscribeTopicProgress(tutorId, (data) => {
          // Filter to this student + current school year
          const filtered = data.filter(
            (p) => p.tuteeId === id && (!p.schoolYear || p.schoolYear === selectedYear)
          );
          setTopicProgress(filtered);
        });
        unsubs.push(unsubProgress);

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
  }, [id, user?.createdByTutorId, selectedYear]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
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
  const currentTopicSubject = activeTopicSubject || subjects[0] || '';

  // Build progress map keyed by `${tuteeId}_${topicId}`
  const progressMap = new Map<string, StudentTopicProgress>();
  topicProgress.forEach((p) => progressMap.set(`${p.tuteeId}_${p.topicId}`, p));

  // Topics for the currently active subject
  const subjectTopics = topics.filter(
    (t) => t.subject.trim().toLowerCase() === currentTopicSubject.trim().toLowerCase()
  );

  // KPI summary
  let masteredCount = 0;
  let inProgressCount = 0;
  let needsImprovementCount = 0;
  subjectTopics.forEach((t) => {
    const prog = progressMap.get(`${id}_${t.id}`);
    if (prog?.performanceLevel === 'mastered') masteredCount++;
    else if (prog?.performanceLevel === 'in-progress') inProgressCount++;
    else if (prog?.performanceLevel === 'needs-improvement') needsImprovementCount++;
  });

  const attendanceRate =
    attendance.totalSessions > 0
      ? Math.round((attendance.presentCount / attendance.totalSessions) * 100)
      : -1;

  const availableMakeUpCredits = makeUpCredits.filter((credit) => credit.status === 'pending');
  const scheduledMakeUpCredits = makeUpCredits.filter((credit) => credit.status === 'scheduled');
  const completedMakeUpCredits = makeUpCredits.filter((credit) => credit.status === 'completed');
  let makeUpSessionCount = 0;
  let regularSessionCount = 0;
  monthlyRecords.forEach((record) => {
    (record.dayPayments || []).forEach((day) => {
      if (day.sessionType === 'make-up' || day.makeUpCreditId) makeUpSessionCount += 1;
      else regularSessionCount += 1;
    });
  });

  const deduplicatedTransactions = transactions.filter((t) => {
    return !payments.some(
      (p) =>
        p.amount === t.totalAmount &&
        p.paymentDate === t.paymentDate &&
        p.paymentMethod === t.paymentMethod
    );
  });

  const mergedTxns: MergedTxn[] = [
    ...deduplicatedTransactions.map((t) => ({
      id: t.id,
      amount: t.totalAmount,
      paymentMethod: t.paymentMethod,
      paymentDate: t.paymentDate,
      notes: t.notes,
      source: 'transaction' as const,
    })),
    ...payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      notes: p.notes,
      status: p.status,
      proofUrl: p.proofUrl,
      source: 'payment' as const,
    })),
  ].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `${tutee.firstName} ${tutee.surname}`,
          headerTintColor: '#2563eb',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
              <MaterialCommunityIcons name="chevron-left" size={28} color="#2563eb" />
            </TouchableOpacity>
          ),
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
                <MaterialCommunityIcons name="calendar-outline" size={18} color="#2563eb" />
                <Text style={styles.sectionTitle}>Schedule</Text>
                <View style={styles.seeAllRow}>
                  <Text style={styles.seeAllText}>See All</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#2563eb" />
                </View>
              </TouchableOpacity>
              {[...tutee.schedule].sort(compareScheduleSlots).map((slot, index) => {
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
              <MaterialCommunityIcons name="credit-card-outline" size={18} color="#2563eb" />
              <Text style={styles.sectionTitle}>Payments</Text>
              <View style={styles.seeAllRow}>
                <Text style={styles.seeAllText}>See All</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#2563eb" />
              </View>
            </TouchableOpacity>
            {mergedTxns.length === 0 ? (
              <Text style={styles.emptyText}>No payment records yet</Text>
            ) : (
              mergedTxns.map((txn) => {
                const statusInfo = txn.status ? STATUS_CONFIG[txn.status] : null;
                return (
                  <View key={txn.id} style={styles.transactionItem}>
                    <View style={styles.transactionInfo}>
                      <View style={styles.transactionAmountRow}>
                        <Text style={styles.transactionAmount}>{formatCurrency(txn.amount)}</Text>
                        {statusInfo && (
                          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                            <Text style={[styles.statusText, { color: statusInfo.color }]}>
                              {statusInfo.label}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.transactionMethod}>{txn.paymentMethod}</Text>
                      {txn.notes && <Text style={styles.txnNotes}>{txn.notes}</Text>}
                      {txn.proofUrl && (
                        <TouchableOpacity onPress={() => setProofViewerUrl(txn.proofUrl!)} activeOpacity={0.7}>
                          <Image source={{ uri: txn.proofUrl }} style={styles.proofThumb} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.transactionDate}>{formatDate(txn.paymentDate)}</Text>
                  </View>
                );
              })
            )}
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => router.push(`/(main)/attendance?from=children/${id}`)} activeOpacity={0.7}>
              <MaterialCommunityIcons name="calendar-check-outline" size={18} color="#2563eb" />
              <Text style={styles.sectionTitle}>Attendance</Text>
              <View style={styles.seeAllRow}>
                <Text style={styles.seeAllText}>See All</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#2563eb" />
              </View>
            </TouchableOpacity>
            <View style={styles.attendanceRow}>
              <View>
                <Text style={styles.attendanceInfo}>
                  {attendance.presentCount} of {attendance.totalSessions} sessions attended
                </Text>
                <Text style={styles.attendanceSub}>Present and scheduled classes</Text>
              </View>
              <View style={[styles.rateBadge, { backgroundColor: attendanceRate < 0 ? '#f3f4f6' : attendanceRate >= 80 ? '#dbeafe' : attendanceRate >= 50 ? '#fef3c7' : '#fef2f2' }]}>
                <Text style={[styles.rateText, { color: attendanceRate < 0 ? '#9ca3af' : attendanceRate >= 80 ? '#2563eb' : attendanceRate >= 50 ? '#d97706' : '#dc2626' }]}>
                  {attendanceRate >= 0 ? `${attendanceRate}%` : '--'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="calendar-clock" size={18} color="#2563eb" />
              <Text style={styles.sectionTitle}>Make-Up Credits</Text>
            </View>

            <View style={styles.kpiRow}>
              <View style={[styles.kpiBox, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                <Text style={[styles.kpiValue, { color: '#b45309' }]}>{availableMakeUpCredits.length}</Text>
                <Text style={[styles.kpiLabel, { color: '#b45309' }]}>Available</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                <Text style={[styles.kpiValue, { color: '#1d4ed8' }]}>{scheduledMakeUpCredits.length}</Text>
                <Text style={[styles.kpiLabel, { color: '#1d4ed8' }]}>Scheduled</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                <Text style={[styles.kpiValue, { color: '#15803d' }]}>{completedMakeUpCredits.length}</Text>
                <Text style={[styles.kpiLabel, { color: '#15803d' }]}>Completed</Text>
              </View>
            </View>

            <Text style={styles.makeUpSummaryText}>
              {regularSessionCount} regular + {makeUpSessionCount} make-up sessions in billing months
            </Text>

            {scheduledMakeUpCredits.length > 0 ? (
              scheduledMakeUpCredits.map((credit) => (
                <View key={credit.id} style={styles.makeUpSessionRow}>
                  <MaterialCommunityIcons name="calendar-check-outline" size={16} color="#2563eb" />
                  <View style={styles.makeUpSessionInfo}>
                    <Text style={styles.makeUpSessionDate}>
                      {formatDate(credit.scheduledDate || '')}
                      {credit.startTime && credit.endTime ? ` · ${credit.startTime}–${credit.endTime}` : ''}
                    </Text>
                    <Text style={styles.makeUpSessionMeta}>
                      Credit from {formatDate(credit.sourceDate)} · {credit.durationMinutes} min
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No upcoming make-up classes</Text>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => router.push(`/(main)/assessments?from=children/${id}`)} activeOpacity={0.7}>
              <MaterialCommunityIcons name="chart-line" size={18} color="#2563eb" />
              <Text style={styles.sectionTitle}>Assessments</Text>
              <View style={styles.seeAllRow}>
                <Text style={styles.seeAllText}>See All</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#2563eb" />
              </View>
            </TouchableOpacity>
            {assessments.length === 0 ? (
              <Text style={styles.emptyText}>No assessment records yet</Text>
            ) : (
              assessments.slice(0, 5).map((a) => (
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

        {/* ── Topic Progress Section ── */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="book-check-outline" size={18} color="#2563eb" />
              <Text style={styles.sectionTitle}>Topic Progress</Text>
            </View>

            {/* Subject selector tabs (only shown for multi-subject students) */}
            {subjects.length > 1 && (
              <View style={styles.subjectTabRow}>
                {subjects.map((subj) => (
                  <TouchableOpacity
                    key={subj}
                    onPress={() => setActiveTopicSubject(subj)}
                    style={[
                      styles.subjectTab,
                      currentTopicSubject === subj && styles.subjectTabActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.subjectTabText,
                        currentTopicSubject === subj && styles.subjectTabTextActive,
                      ]}
                    >
                      {subj}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* KPI summary row */}
            {subjectTopics.length > 0 && (
              <View style={styles.kpiRow}>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiValue}>{subjectTopics.length}</Text>
                  <Text style={styles.kpiLabel}>Total</Text>
                </View>
                <View style={[styles.kpiBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                  <Text style={[styles.kpiValue, { color: '#15803d' }]}>{masteredCount}</Text>
                  <Text style={[styles.kpiLabel, { color: '#15803d' }]}>Mastered</Text>
                </View>
                <View style={[styles.kpiBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                  <Text style={[styles.kpiValue, { color: '#1d4ed8' }]}>{inProgressCount}</Text>
                  <Text style={[styles.kpiLabel, { color: '#1d4ed8' }]}>In Progress</Text>
                </View>
                <View style={[styles.kpiBox, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                  <Text style={[styles.kpiValue, { color: '#b45309' }]}>{needsImprovementCount}</Text>
                  <Text style={[styles.kpiLabel, { color: '#b45309' }]}>Needs Work</Text>
                </View>
              </View>
            )}

            {/* Topic list */}
            {subjectTopics.length === 0 ? (
              <Text style={styles.emptyText}>
                No topics added yet for {currentTopicSubject || 'this subject'}.
              </Text>
            ) : (
              subjectTopics.map((topic) => {
                const prog = progressMap.get(`${id}_${topic.id}`);
                const level = prog?.performanceLevel ?? 'not-started';
                const cfg = LEVEL_CONFIG[level];
                const scoreWidth = prog ? Math.min(prog.score, 100) : 0;

                return (
                  <View key={topic.id} style={styles.topicCard}>
                    {/* Header row */}
                    <View style={styles.topicHeader}>
                      <Text style={styles.topicName} numberOfLines={2}>
                        {topic.name}
                      </Text>
                      <View style={[styles.levelBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                        <Text style={[styles.levelBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>

                    {topic.description ? (
                      <Text style={styles.topicDesc} numberOfLines={2}>{topic.description}</Text>
                    ) : null}

                    {/* Score + progress bar */}
                    {prog ? (
                      <>
                        <View style={styles.scoreRow}>
                          <Text style={styles.scoreLabel}>Score</Text>
                          <Text style={[styles.scoreValue, { color: cfg.color }]}>{prog.score}%</Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${scoreWidth}%` as any, backgroundColor: cfg.barColor },
                            ]}
                          />
                        </View>

                        {prog.strengths ? (
                          <View style={[styles.noteBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                            <Text style={styles.noteLabel}>Strengths</Text>
                            <Text style={[styles.noteText, { color: '#166534' }]}>{prog.strengths}</Text>
                          </View>
                        ) : null}

                        {prog.areasForImprovement ? (
                          <View style={[styles.noteBox, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                            <Text style={styles.noteLabel}>Areas for Improvement</Text>
                            <Text style={[styles.noteText, { color: '#92400e' }]}>{prog.areasForImprovement}</Text>
                          </View>
                        ) : null}

                        {prog.notes ? (
                          <View style={[styles.noteBox, { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }]}>
                            <Text style={styles.noteLabel}>Tutor Notes</Text>
                            <Text style={[styles.noteText, { color: '#374151', fontStyle: 'italic' }]}>{prog.notes}</Text>
                          </View>
                        ) : null}
                      </>
                    ) : (
                      <Text style={styles.noEvalText}>No evaluation recorded yet.</Text>
                    )}
                  </View>
                );
              })
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      <Modal visible={!!proofViewerUrl} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setProofViewerUrl(null)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              onPress={() => setProofViewerUrl(null)}
              style={styles.modalClose}
            >
              <MaterialCommunityIcons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
            {proofViewerUrl && (
              <Image source={{ uri: proofViewerUrl }} style={styles.modalImage} resizeMode="contain" />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff6ff',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
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
  profileCard: {
    borderRadius: 16,
    marginBottom: 16,
    elevation: 1,
    backgroundColor: '#ffffff',
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarFallback: {
    backgroundColor: '#2563eb',
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
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  subjectText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: 16,
    marginBottom: 16,
    elevation: 1,
    backgroundColor: '#ffffff',
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
    color: '#2563eb',
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
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  transactionMethod: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  txnNotes: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
    fontStyle: 'italic',
  },
  proofThumb: {
    width: 80,
    height: 56,
    borderRadius: 6,
    marginTop: 6,
    resizeMode: 'cover',
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
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  attendanceInfo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  attendanceSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  makeUpSummaryText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  makeUpSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  makeUpSessionInfo: {
    flex: 1,
  },
  makeUpSessionDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  makeUpSessionMeta: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 1,
  },
  rateBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  rateText: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 8,
  },
  modalImage: {
    width: '90%',
    height: '70%',
    borderRadius: 8,
  },
  // ── Topic progress styles ──
  subjectTabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  subjectTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  subjectTabActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  subjectTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  subjectTabTextActive: {
    color: '#ffffff',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  kpiBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  topicCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  topicName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 20,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  topicDesc: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
    lineHeight: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  scoreValue: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  noteBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
  noteLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 17,
  },
  noEvalText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 6,
  },
});
