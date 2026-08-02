import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tutee } from '../types/tutee';
import { formatCurrency } from '../utils/formatCurrency';
import { formatTime12h } from '../utils/formatTime';
import { ScaleOnPress } from './ScaleOnPress';

interface ChildCardProps {
  tutee: Tutee;
  metrics: {
    attendanceRate: number;
    averageScore: number;
    totalPaid: number;
    balance: number;
    paymentStatus: string;
  };
  onPress: () => void;
}

export const ChildCard = ({ tutee, metrics, onPress }: ChildCardProps) => {
  const subjects = tutee.subjects?.length ? tutee.subjects : [tutee.subject];

  const renderSchedule = () => {
    if (Array.isArray(tutee.schedule)) {
      return tutee.schedule.map((slot, index) => {
        if (typeof slot === 'object' && slot !== null && 'startTime' in slot && 'endTime' in slot) {
          return (
            <Text key={index} style={styles.scheduleText}>
              {slot.day}: {formatTime12h(slot.startTime || '')} - {formatTime12h(slot.endTime || '')}
            </Text>
          );
        }
        return null;
      });
    }
    return null;
  };

  return (
    <ScaleOnPress onPress={onPress} style={styles.card}>
      <Card>
        <Card.Content>
        <View style={styles.header}>
          {tutee.photoUrl ? (
            <Avatar.Image size={52} source={{ uri: tutee.photoUrl }} style={styles.avatar} />
          ) : (
            <Avatar.Text
              size={52}
              label={`${tutee.firstName.charAt(0)}${tutee.surname.charAt(0)}`}
              style={styles.avatarFallback}
              labelStyle={styles.avatarLabel}
            />
          )}
          <View style={styles.headerText}>
            <Text style={styles.name}>{tutee.firstName} {tutee.surname}</Text>
            <Text style={styles.grade}>{tutee.gradeLevel}</Text>
            <View style={styles.subjectRow}>
              {subjects.map((s) => (
                <View key={s} style={styles.subjectBadge}>
                  <Text style={styles.subjectText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <View style={[styles.metricBox, { backgroundColor: '#ecfdf5' }]}>
            <MaterialCommunityIcons name="check-circle-outline" size={16} color="#059669" />
            <Text style={[styles.metricValue, { color: '#059669' }]}>{metrics.attendanceRate}%</Text>
            <Text style={styles.metricLabel}>Attendance</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: '#eef2ff' }]}>
            <MaterialCommunityIcons name="trending-up" size={16} color="#4f46e5" />
            <Text style={[styles.metricValue, { color: '#4f46e5' }]}>
              {metrics.averageScore > 0 ? `${metrics.averageScore}%` : 'N/A'}
            </Text>
            <Text style={styles.metricLabel}>Avg Score</Text>
          </View>
        </View>

        <View style={styles.paymentRow}>
          <View style={[styles.paymentBox, { backgroundColor: '#ecfdf5' }]}>
            <Text style={[styles.paymentValue, { color: '#059669' }]}>{formatCurrency(metrics.totalPaid)}</Text>
            <Text style={styles.paymentLabel}>Paid</Text>
          </View>
          <View style={[styles.paymentBox, { backgroundColor: '#fff7ed' }]}>
            <Text style={[styles.paymentValue, { color: '#ea580c' }]}>{formatCurrency(metrics.balance)}</Text>
            <Text style={styles.paymentLabel}>Balance</Text>
          </View>
          <View style={[styles.paymentBox, {
            backgroundColor: metrics.paymentStatus === 'Paid' ? '#ecfdf5' : metrics.paymentStatus === 'Partial' ? '#fff7ed' : '#f9fafb'
          }]}>
            <Text style={[styles.paymentStatus, {
              color: metrics.paymentStatus === 'Paid' ? '#059669' : metrics.paymentStatus === 'Partial' ? '#ea580c' : '#9ca3af'
            }]}>
              {metrics.paymentStatus}
            </Text>
            <Text style={styles.paymentLabel}>Status</Text>
          </View>
        </View>

        <View style={styles.scheduleSection}>
          <MaterialCommunityIcons name="calendar-outline" size={14} color="#2563eb" />
          <View style={styles.scheduleContent}>
            <Text style={styles.scheduleTitle}>SCHEDULE</Text>
            {renderSchedule()}
          </View>
        </View>

        <View style={styles.viewButton}>
          <Text style={styles.viewButtonText}>View Details & Reports</Text>
        </View>
        </Card.Content>
      </Card>
    </ScaleOnPress>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 16,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  avatar: {
    marginRight: 12,
  },
  avatarFallback: {
    backgroundColor: '#2563eb',
    marginRight: 12,
  },
  avatarLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  grade: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 1,
  },
  subjectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  subjectBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  subjectText: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  metricBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  paymentBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  paymentValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: '800',
  },
  paymentLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  scheduleSection: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9ca3af',
  },
  scheduleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 2,
  },
  viewButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
