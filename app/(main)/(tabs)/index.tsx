import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Modal,
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
import { paymentService, MonthlyRecord } from '../../../src/services/paymentService';
import { assessmentService } from '../../../src/services/assessmentService';
import { announcementService } from '../../../src/services/announcementService';
import { Announcement } from '../../../src/types/announcement';
import { Assessment } from '../../../src/types/assessment';
import { EmptyState } from '../../../src/components/EmptyState';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AnimatedBar } from '../../../src/components/AnimatedBar';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../src/services/firebaseConfig';

const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Returns a time-based greeting based on the current local hour. */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning,';
  if (hour >= 12 && hour < 18) return 'Good Afternoon,';
  return 'Good Evening,';
}

/** Returns the current school year label (Philippine: June–May convention). */
function getCurrentSchoolYearLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;
  return `SY ${startYear}–${String(endYear).slice(-2)}`;
}


function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll: () => void }) {
  return (
    <TouchableOpacity style={styles.sectionHeaderRow} onPress={onSeeAll} activeOpacity={0.7}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.seeAllRow}>
        <Text style={styles.seeAllText}>See all</Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color="#2563eb" />
      </View>
    </TouchableOpacity>
  );
}

function getGradeLetter(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function getRoomForSubject(subjectName: string): string {
  const sub = (subjectName || '').toLowerCase();
  if (sub.includes('math')) return 'Rm 12';
  if (sub.includes('sci')) return 'Lab A';
  if (sub.includes('hist')) return 'Rm 6';
  if (sub.includes('eng')) return 'Rm 3';
  return 'Rm 1';
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const { tutees, isLoading: tuteesLoading } = useTutees();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [payments, setPayments] = useState<Record<string, number>>({});
  const [verifiedPayments, setVerifiedPayments] = useState<Record<string, number>>({});
  const [monthlyRecords, setMonthlyRecords] = useState<Record<string, MonthlyRecord[]>>({});
  const [attendance, setAttendance] = useState<Record<string, { presentCount: number; totalSessions: number }>>({});
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [tutorName, setTutorName] = useState<string>('Tutor');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDay = days[new Date().getDay()];
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(currentDay) ? currentDay : 'Mon';
  });

  const tutorId = user?.createdByTutorId || '';

  const loadData = useCallback(() => {
    if (!tutorId || !tutees.length) {
      setLoading(false);
      return;
    }

    const tuteeIds = tutees.map((t) => t.id);

    // Fetch tutor name
    getDoc(doc(db, 'users', tutorId))
      .then((docSnap) => {
        if (docSnap.exists()) {
          setTutorName(docSnap.data()?.name || 'Tutor');
        }
      })
      .catch((err) => console.error('Error fetching tutor name:', err));

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
      unsubPayments.push(
        paymentService.subscribeVerifiedAmountByTutee(tutorId, tutee.id, (verified: number) => {
          setVerifiedPayments((prev) => ({ ...prev, [tutee.id]: verified }));
        })
      );
      unsubPayments.push(
        paymentService.subscribeRecordsByTutee(tutorId, tutee.id, (recs) => {
          setMonthlyRecords((prev) => ({ ...prev, [tutee.id]: recs }));
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

  const getWeekRangeLabel = () => {
    const today = new Date();
    const first = today.getDate() - today.getDay() + 1; // Monday
    const last = first + 4; // Friday
    const monday = new Date(today.setDate(first));
    const friday = new Date(today.setDate(last));
    const monMonth = monday.toLocaleString('default', { month: 'short' });
    const friMonth = friday.toLocaleString('default', { month: 'short' });
    if (monMonth === friMonth) {
      return `${monMonth} ${monday.getDate()}-${friday.getDate()}`;
    } else {
      return `${monMonth} ${monday.getDate()} - ${friMonth} ${friday.getDate()}`;
    }
  };

  const getDueDateLabel = () => {
    const today = new Date();
    today.setDate(15);
    return `DUE ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}`;
  };

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

  // Redesign: Combined statistics for all children
  let totalPresent = 0;
  let totalSessions = 0;
  tutees.forEach((t) => {
    const attData = attendance[t.id] || { presentCount: 0, totalSessions: 0 };
    totalPresent += attData.presentCount;
    totalSessions += attData.totalSessions;
  });
  const attendanceRate = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 100;
  const absentCount = totalSessions - totalPresent;

  const avgScore = assessments.length > 0
    ? Math.round((assessments.reduce((sum, a) => sum + (a.score || 0), 0) / assessments.length) * 10) / 10
    : 0;

  const subjectTuteeAverages: Record<string, { sum: number; count: number; tuteeName: string; subject: string; tuteeId: string }> = {};
  assessments.forEach((a) => {
    const sub = a.subject || 'General';
    const key = `${a.tuteeId}_${sub}`;
    if (!subjectTuteeAverages[key]) {
      subjectTuteeAverages[key] = {
        sum: 0,
        count: 0,
        tuteeName: a.tuteeName || 'Child',
        subject: sub,
        tuteeId: a.tuteeId,
      };
    }
    subjectTuteeAverages[key].sum += a.score || 0;
    subjectTuteeAverages[key].count += 1;
  });
  const subjectTuteeKeys = Object.keys(subjectTuteeAverages);

  const totalPaid = Math.round(tutees.reduce((sum, t) => sum + (payments[t.id] || 0) + (verifiedPayments[t.id] || 0), 0));
  const totalOutstanding = Math.max(Math.round(tutees.reduce((sum, t) => {
    const recs = monthlyRecords[t.id];
    if (recs && recs.length > 0) {
      return sum + recs.filter((r) => r.totalBalance > 0).reduce((s, r) => s + (r.totalBalance || 0), 0);
    }
    const paid = (payments[t.id] || 0) + (verifiedPayments[t.id] || 0);
    const due = (t.totalSessions || 0) * (t.ratePerSession || 0);
    return sum + Math.max(due - paid, 0);
  }, 0)), 0);

  const latestAnnouncement = announcements.length > 0 ? announcements[0] : null;

  const allSchedule: any[] = [];
  tutees.forEach((tutee) => {
    if (tutee.schedule && Array.isArray(tutee.schedule)) {
      tutee.schedule.forEach((s: any) => {
        allSchedule.push({ ...s, tuteeName: tutee.firstName, tuteeId: tutee.id, mainSubject: tutee.subject });
      });
    }
  });

  const selectedDaySessions = allSchedule.filter((s: any) => {
    if (!s || typeof s !== 'object') return false;
    const day = s.day || '';
    const abbr = day.slice(0, 3);
    const orderAbbr = selectedDay.slice(0, 3);
    return abbr.toLowerCase() === orderAbbr.toLowerCase() || day.toLowerCase() === selectedDay.toLowerCase();
  });
  const sortedDaySessions = [...selectedDaySessions].sort((a: any, b: any) => {
    const timeA = a.startTime || a.time || '';
    const timeB = b.startTime || b.time || '';
    return timeA.localeCompare(timeB);
  });

  const totalChildren = tutees.length;
  const childInitial = totalChildren.toString();
  const gradeLabel = totalChildren === 1
    ? (tutees[0]?.gradeLevel || '1 Enrolled Student')
    : `${totalChildren} Enrolled Students`;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 16, paddingBottom: tabBarHeight + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
    >
      {/* Redesigned Header Layout */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerGreeting}>{getGreeting()}</Text>
          <Text style={styles.headerName}>{user.name || 'Parent'}</Text>
        </View>
      </View>

      {/* Redesigned Child details banner */}
      <Card style={styles.childBannerCard}>
        <Card.Content style={styles.childBannerContent}>
          <View style={styles.childAvatarCircle}>
            <Text style={styles.childAvatarText}>{childInitial}</Text>
          </View>
          <View style={styles.childBannerInfo}>
            <Text style={styles.childBannerName}>
              Linked {totalChildren === 1 ? 'Student' : 'Students'}
            </Text>
            <Text style={styles.childBannerGrade}>
              {gradeLabel}
            </Text>
          </View>
          <View style={styles.enrolledBadge}>
            <Text style={styles.enrolledBadgeText}>ENROLLED</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Redesigned 2x2 KPI Grid */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiItem}>
          <Card style={styles.kpiCardCustom}>
            <Card.Content style={styles.kpiCardContentCustom}>
              <View style={[styles.kpiDot, { backgroundColor: '#10b981' }]} />
              <View>
                <Text style={[styles.kpiValueCustom, { color: '#10b981' }]}>{attendanceRate}%</Text>
                <Text style={styles.kpiTitleCustom}>Attendance</Text>
              </View>
              <Text style={styles.kpiFooterCustom}>
                {new Date().toLocaleString('default', { month: 'short', year: 'numeric' })}
              </Text>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.kpiItem}>
          <Card style={styles.kpiCardCustom}>
            <Card.Content style={styles.kpiCardContentCustom}>
              <View style={[styles.kpiDot, { backgroundColor: '#f59e0b' }]} />
              <View>
                <Text style={[styles.kpiValueCustom, { color: '#d97706' }]}>{avgScore > 0 ? avgScore : '--'}</Text>
                <Text style={styles.kpiTitleCustom}>Avg Score</Text>
              </View>
              <Text style={styles.kpiFooterCustom}>
                {subjectTuteeKeys.length} {subjectTuteeKeys.length === 1 ? 'subject score' : 'subject scores'}
              </Text>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.kpiItem}>
          <Card style={styles.kpiCardCustom}>
            <Card.Content style={styles.kpiCardContentCustom}>
              <View style={[styles.kpiDot, { backgroundColor: '#3b82f6' }]} />
              <View>
                <Text style={[styles.kpiValueCustom, { color: '#10b981' }]}>{formatCurrency(totalPaid)}</Text>
                <Text style={styles.kpiTitleCustom}>Total Paid</Text>
              </View>
              <Text style={styles.kpiFooterCustom}>{getCurrentSchoolYearLabel()}</Text>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.kpiItem}>
          <Card style={styles.kpiCardCustom}>
            <Card.Content style={styles.kpiCardContentCustom}>
              <View style={[styles.kpiDot, { backgroundColor: '#ef4444' }]} />
              <View>
                <Text style={[styles.kpiValueCustom, { color: '#ef4444' }]}>{formatCurrency(totalOutstanding)}</Text>
                <Text style={styles.kpiTitleCustom}>Balance Due</Text>
              </View>
              <Text style={styles.kpiFooterCustom}>
                {totalChildren > 1 ? 'Combined rate' : (tutees[0].lastPaymentDate
                  ? `Paid ${new Date(tutees[0].lastPaymentDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                  : 'Monthly tuition')}
              </Text>
            </Card.Content>
          </Card>
        </View>
      </View>

      {/* Redesigned Tuition/Outstanding Balance Banner Card */}
      <Card style={styles.tuitionBannerCard}>
        <Card.Content style={styles.tuitionBannerContent}>
          <View style={styles.tuitionBannerLeft}>
            <Text style={styles.tuitionDueDate}>{getDueDateLabel()}</Text>
            <Text style={styles.tuitionAmount}>{formatCurrency(totalOutstanding)}</Text>
            <Text style={styles.tuitionLabel}>Monthly Tuition</Text>
          </View>
          <TouchableOpacity
            style={styles.payNowButton}
            onPress={() => router.push('/(main)/payments')}
            activeOpacity={0.8}
          >
            <Text style={styles.payNowButtonText}>Pay Now</Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>

      {/* Redesigned Weekly Schedule Layout */}
      <View style={styles.scheduleHeaderRow}>
        <Text style={styles.sectionTitle}>Weekly Schedule</Text>
        <Text style={styles.scheduleDateRange}>{getWeekRangeLabel()}</Text>
      </View>
      <View style={styles.daysRow}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => {
          const isActive = selectedDay === day;
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayTab, isActive && styles.dayTabActive]}
              onPress={() => setSelectedDay(day)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayTabText, isActive && styles.dayTabTextActive]}>{day}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {sortedDaySessions.length === 0 ? (
        <Card style={styles.emptyScheduleCard}>
          <Card.Content>
            <Text style={styles.emptyScheduleText}>No sessions scheduled for this day</Text>
          </Card.Content>
        </Card>
      ) : (
        sortedDaySessions.map((session: any, idx) => {
          const timeString = formatTime12h(session.startTime || session.time || '');
          const [timeVal, timePeriod] = timeString.split(' ');
          return (
            <Card key={idx} style={styles.scheduleSessionCard}>
              <Card.Content style={styles.scheduleSessionContent}>
                <View style={styles.scheduleTimeCol}>
                  <Text style={styles.scheduleTimeVal}>{timeVal}</Text>
                  <Text style={styles.scheduleTimePeriod}>{timePeriod}</Text>
                </View>
                <View style={styles.scheduleSessionDivider} />
                <View style={styles.scheduleDetailsCol}>
                  <Text style={styles.scheduleSubject}>
                    {session.subject || session.mainSubject || 'Session'} - {session.tuteeName}
                  </Text>
                  <Text style={styles.scheduleRoom}>
                    {getRoomForSubject(session.subject || session.mainSubject)}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          );
        })
      )}

      {/* Redesigned Attendance Section */}
      <SectionHeader title="Attendance" onSeeAll={() => router.push('/(main)/attendance')} />
      <Card style={styles.sectionCard}>
        <Card.Content>
          <View style={styles.attendanceSummaryRow}>
            <Text style={styles.attendancePercentage}>{attendanceRate}%</Text>
            <Text style={styles.attendanceMonthLabel}>
              {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <View style={styles.attendanceProgressBarTrack}>
            <AnimatedBar
              axis="horizontal"
              width={`${attendanceRate}%`}
              backgroundColor="#0d5c46"
              style={styles.attendanceProgressBarFill}
              delay={100}
            />
          </View>
          <View style={styles.attendanceStatsRow}>
            <Text style={[styles.attendanceStatText, { color: '#059669' }]}>
              ✓ {totalPresent} present
            </Text>
            <Text style={[styles.attendanceStatText, { color: '#dc2626' }]}>
              ✕ {absentCount} absent
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Redesigned Subject Scores Section with SVG rings */}
      <SectionHeader title="Subject Scores" onSeeAll={() => router.push('/(main)/assessments')} />
      <Card style={styles.sectionCard}>
        <Card.Content style={{ paddingVertical: 4 }}>
          {subjectTuteeKeys.length === 0 ? (
            <EmptyState
              icon="file-document-outline"
              title="No Scores"
              message="No subject scores available yet."
            />
          ) : (
            subjectTuteeKeys.map((key) => {
              const item = subjectTuteeAverages[key];
              const avg = Math.round(item.sum / item.count);
              const size = 48;
              const strokeWidth = 3;
              const radius = (size - strokeWidth) / 2;
              const circumference = radius * 2 * Math.PI;
              const strokeDashoffset = circumference - (avg / 100) * circumference;

              return (
                <View style={styles.subjectScoreRow} key={key}>
                  <View style={styles.svgContainer}>
                    <Svg width={size} height={size}>
                      <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="#f3f4f6"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                      />
                      <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="#2563eb"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                      />
                    </Svg>
                    <View style={styles.gradeContainer}>
                      <Text style={styles.gradeLetter}>{getGradeLetter(avg)}</Text>
                    </View>
                  </View>
                  <View style={styles.subjectTextCol}>
                    <Text style={styles.subjectName}>{item.subject}</Text>
                    <Text style={styles.subjectTutor}>{item.tuteeName} · {tutorName}</Text>
                  </View>
                  <View style={styles.scoreCol}>
                    <Text style={styles.scoreVal}>{avg}%</Text>
                  </View>
                </View>
              );
            })
          )}
        </Card.Content>
      </Card>

      {/* Redesigned Announcement Banner Card */}
      {latestAnnouncement && (
        <TouchableOpacity
          style={styles.announcementBannerCard}
          onPress={() => router.navigate(`/(main)/announcements/${latestAnnouncement.id}`)}
          activeOpacity={0.9}
        >
          <View style={styles.announcementBannerContent}>
            <View style={styles.announcementBannerIconBg}>
              <MaterialCommunityIcons name="bullhorn" size={20} color="#ffffff" />
            </View>
            <View style={styles.announcementBannerTextContainer}>
              <Text style={styles.announcementBannerTitle}>{latestAnnouncement.title}</Text>
              <Text style={styles.announcementBannerBody} numberOfLines={2}>
                {latestAnnouncement.content}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  headerGreeting: {
    fontSize: 14,
    color: '#4b5563',
  },
  headerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 16,
    marginTop: 8,
  },
  childBannerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  childBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  childAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  childAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  childBannerInfo: {
    flex: 1,
  },
  childBannerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  childBannerGrade: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  enrolledBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  enrolledBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  kpiItem: {
    width: '48%',
    marginBottom: 12,
  },
  kpiCardCustom: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  kpiCardContentCustom: {
    height: 115,
    justifyContent: 'space-between',
    padding: 12,
  },
  kpiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kpiValueCustom: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1f2937',
  },
  kpiTitleCustom: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 1,
  },
  kpiFooterCustom: {
    fontSize: 9,
    color: '#9ca3af',
  },
  tuitionBannerCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 16,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  tuitionBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tuitionBannerLeft: {
    flex: 1,
  },
  tuitionDueDate: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b91c1c',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tuitionAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#991b1b',
  },
  tuitionLabel: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 1,
  },
  payNowButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  payNowButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  scheduleDateRange: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dayTabActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  dayTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  dayTabTextActive: {
    color: '#ffffff',
  },
  emptyScheduleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    elevation: 1,
    paddingVertical: 8,
  },
  emptyScheduleText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
  scheduleSessionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  scheduleSessionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  scheduleTimeCol: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleTimeVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937',
  },
  scheduleTimePeriod: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9ca3af',
    marginTop: 1,
  },
  scheduleSessionDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 12,
  },
  scheduleDetailsCol: {
    flex: 1,
  },
  scheduleSubject: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  scheduleRoom: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  attendanceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  attendancePercentage: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1f2937',
  },
  attendanceMonthLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  attendanceProgressBarTrack: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  attendanceProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  attendanceStatsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  attendanceStatText: {
    fontSize: 13,
    fontWeight: '600',
  },
  subjectScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  svgContainer: {
    position: 'relative',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeLetter: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1f2937',
  },
  subjectTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subjectTutor: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  scoreCol: {
    alignItems: 'flex-end',
  },
  scoreVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937',
  },
  announcementBannerCard: {
    backgroundColor: '#1e3a8a',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 16,
  },
  announcementBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  announcementBannerIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  announcementBannerTextContainer: {
    flex: 1,
  },
  announcementBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  announcementBannerBody: {
    fontSize: 12,
    color: '#bfdbfe',
    lineHeight: 16,
  },
});
