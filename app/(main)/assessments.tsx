import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTabBarHeight } from '../../src/hooks/useTabBarHeight';
import { useAuth } from '../../src/hooks/useAuth';
import { useTutees } from '../../src/hooks/useTutees';
import { assessmentService } from '../../src/services/assessmentService';
import { Assessment } from '../../src/types/assessment';
import { formatDate } from '../../src/utils/formatDate';
import { EmptyState } from '../../src/components/EmptyState';

const assessmentMonth = (a: Assessment) =>
  typeof a.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(a.date)
    ? a.date.slice(0, 7)
    : (() => {
        const d = new Date(a.date);
        const month = `${d.getMonth() + 1}`.padStart(2, '0');
        return `${d.getFullYear()}-${month}`;
      })();

const monthLabel = (ym: string) => {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

export default function AssessmentsScreen() {
  const { user } = useAuth();
  const { tutees } = useTutees();
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [monthFilter, setMonthFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const focusTuteeId = from?.startsWith('children/') ? from.split('/')[1] : undefined;
  const scopeTutees = focusTuteeId ? tutees.filter((t) => t.id === focusTuteeId) : tutees;
  const focusedTutee = focusTuteeId ? tutees.find((t) => t.id === focusTuteeId) : null;

  useEffect(() => {
    if (!user?.createdByTutorId) return;

    const tuteeIds = (focusTuteeId ? tutees.filter((t) => t.id === focusTuteeId) : tutees).map((t) => t.id);
    if (tuteeIds.length === 0) {
      setLoading(false);
      return;
    }

    const unsub = assessmentService.subscribeAll(user.createdByTutorId, tuteeIds, (data) => {
      setAssessments(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
    });

    return () => unsub();
  }, [user?.createdByTutorId, focusTuteeId, tutees]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const subjectOptions = ['All', ...Array.from(
    new Set(assessments.map((a) => a.subject || 'General'))
  ).sort()];

  const monthOptions = Array.from(
    new Set(assessments.map(assessmentMonth))
  ).sort().reverse();

  const hasFilters = monthFilter !== '' || subjectFilter !== 'All';

  const filteredAssessments = assessments
    .filter((a) => {
      if (monthFilter !== '' && assessmentMonth(a) !== monthFilter) return false;
      if (subjectFilter !== 'All' && (a.subject || 'General') !== subjectFilter) return false;
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const assessmentsByChild = scopeTutees
    .map((tutee) => ({
      tutee,
      items: filteredAssessments.filter((a) => a.tuteeId === tutee.id),
    }))
    .filter((group) => group.items.length > 0);

  const clearFilters = () => {
    setMonthFilter('');
    setSubjectFilter('All');
  };

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: focusedTutee ? `${focusedTutee.firstName}'s Assessments` : '',
        headerTintColor: '#2563eb',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#eff6ff' },
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#2563eb" />
          </TouchableOpacity>
        ),
      }} />
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}>
        <View style={styles.filterSection}>
          <TouchableOpacity
            style={[styles.dropdownButton, dropdownOpen && styles.dropdownButtonActive]}
            onPress={() => setDropdownOpen(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="calendar-month-outline" size={18} color="#2563eb" />
            <View style={styles.dropdownTextContainer}>
              <Text style={styles.dropdownLabel}>Month</Text>
              <Text style={[styles.dropdownValue, monthFilter === '' && styles.dropdownPlaceholder]}>
                {monthFilter === '' ? 'All Months' : monthLabel(monthFilter)}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-down" size={20} color="#9ca3af" />
          </TouchableOpacity>
          <View style={styles.subjectsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectScrollContent}>
              {subjectOptions.map((subject) => {
                const isActive = subjectFilter === subject;
                return (
                  <TouchableOpacity
                    key={subject}
                    style={[styles.subjectChip, isActive && styles.subjectChipSelected]}
                    onPress={() => setSubjectFilter(subject)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.subjectChipText, isActive && styles.subjectChipTextSelected]}>
                      {subject}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {hasFilters && (
              <TouchableOpacity style={styles.clearButton} onPress={clearFilters} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close-circle-outline" size={16} color="#dc2626" />
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Modal
          visible={dropdownOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setDropdownOpen(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setDropdownOpen(false)}
          >
            <View style={styles.dropdownSheet}>
              <TouchableOpacity
                style={[styles.dropdownOption, monthFilter === '' && styles.dropdownOptionSelected]}
                onPress={() => {
                  setMonthFilter('');
                  setDropdownOpen(false);
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="calendar-blank-outline" size={18} color={monthFilter === '' ? '#2563eb' : '#6b7280'} />
                <Text style={[styles.dropdownOptionText, monthFilter === '' && styles.dropdownOptionTextSelected]}>
                  All Months
                </Text>
                {monthFilter === '' && (
                  <MaterialCommunityIcons name="check" size={18} color="#2563eb" />
                )}
              </TouchableOpacity>
              {monthOptions.map((ym) => {
                const isSelected = monthFilter === ym;
                return (
                  <TouchableOpacity
                    key={ym}
                    style={[styles.dropdownOption, isSelected && styles.dropdownOptionSelected]}
                    onPress={() => {
                      setMonthFilter(ym);
                      setDropdownOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="calendar-month-outline" size={18} color={isSelected ? '#2563eb' : '#6b7280'} />
                    <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}>
                      {monthLabel(ym)}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons name="check" size={18} color="#2563eb" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>

        {assessmentsByChild.length === 0 ? (
          <EmptyState
            icon="file-document-outline"
            title="No Assessments"
            message={
              hasFilters
                ? 'No assessments match the selected filters.'
                : 'No assessment records available yet.'
            }
          />
        ) : (
          assessmentsByChild.map(({ tutee, items }, groupIdx) => (
            <View key={tutee.id}>
              <View style={styles.childSectionHeader}>
                <MaterialCommunityIcons name="account-child-outline" size={18} color="#2563eb" />
                <Text style={styles.childSectionName}>{tutee.firstName} {tutee.surname}</Text>
                <Text style={styles.childSectionCount}>{items.length}</Text>
              </View>
              {items.map((a) => {
                const isExpanded = expandedId === a.id;
                return (
                  <Card
                    key={a.id}
                    style={styles.card}
                    onPress={() => setExpandedId(isExpanded ? null : a.id)}
                  >
                    <Card.Content>
                      <View style={styles.cardHeader}>
                        <View style={styles.cardLeft}>
                          <Text style={styles.subject}>{a.subject || 'General'}</Text>
                          <Text style={styles.childName}>{tutee ? `${tutee.firstName} ${tutee.surname}` : 'Unknown'}</Text>
                        </View>
                        <View style={styles.cardHeaderRight}>
                          <View style={styles.scoreBadge}>
                            <Text style={styles.score}>{a.score}%</Text>
                          </View>
                          <MaterialCommunityIcons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color="#9ca3af"
                          />
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
                      {isExpanded && (
                        <View style={styles.cardExpanded}>
                          {Array.isArray(a.assessmentScores) && a.assessmentScores.length > 0 && (
                            <View style={styles.expandedSection}>
                              <Text style={styles.expandedLabel}>Scores Breakdown</Text>
                              {a.assessmentScores.map((s, idx) => {
                                const rowPct = s.totalScore > 0 ? Math.round((s.score / s.totalScore) * 100) : 0;
                                return (
                                  <View key={idx} style={styles.breakdownRow}>
                                    <Text style={styles.breakdownName} numberOfLines={1}>{s.name || `Score ${idx + 1}`}</Text>
                                    <Text style={styles.breakdownValue}>
                                      {s.score} / {s.totalScore} pts ({rowPct}%)
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                          {!!a.notes && (
                            <View style={styles.expandedSection}>
                              <Text style={styles.expandedLabel}>Tutor Notes & Observations</Text>
                              <Text style={styles.expandedText}>{a.notes}</Text>
                            </View>
                          )}
                          {!!a.recommendations && (
                            <View style={styles.expandedSection}>
                              <Text style={styles.expandedLabel}>Recommendations</Text>
                              <Text style={[styles.expandedText, styles.recommendationsText]}>{a.recommendations}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </Card.Content>
                  </Card>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eff6ff' },
  content: { padding: 16, paddingBottom: 110 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#eff6ff' },
  filterSection: {
    marginBottom: 16,
    gap: 12,
  },
  dropdownButton: {
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
  dropdownButtonActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  dropdownTextContainer: {
    flex: 1,
  },
  dropdownLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  dropdownValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  dropdownPlaceholder: {
    color: '#9ca3af',
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
  subjectsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  subjectChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  subjectChipSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  subjectChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  subjectChipTextSelected: {
    color: '#2563eb',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
  },
  childSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
    gap: 6,
  },
  childSectionName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
  },
  childSectionCount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  card: { marginBottom: 10, borderRadius: 14, elevation: 1, backgroundColor: '#ffffff' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLeft: { flex: 1 },
  subject: { fontSize: 16, fontWeight: '700', color: '#111827' },
  childName: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  scoreBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  score: { fontSize: 16, fontWeight: '800', color: '#2563eb' },
  topic: { fontSize: 13, color: '#6b7280', marginTop: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  date: { fontSize: 12, color: '#9ca3af' },
  remarks: { fontSize: 12, fontWeight: '700' },
  cardExpanded: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    gap: 12,
  },
  expandedSection: {
    gap: 6,
  },
  expandedLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  breakdownName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
    backgroundColor: '#dbeafe',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  expandedText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 19,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
  },
  recommendationsText: {
    color: '#1e3a8a',
    borderColor: '#bfdbfe',
  },
});
