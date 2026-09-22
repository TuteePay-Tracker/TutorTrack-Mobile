import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSchoolYear } from '../contexts/SchoolYearContext';
import { formatSchoolYear } from '../utils/schoolYear';

interface SchoolYearSelectorProps {
  visible: boolean;
  onClose: () => void;
}

interface SchoolYearConfirmDialogProps {
  pendingYear: string | null;
  selectedYear: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SchoolYearConfirmDialog({
  pendingYear,
  selectedYear,
  onConfirm,
  onCancel,
}: SchoolYearConfirmDialogProps) {
  const pendingLabel = pendingYear ? formatSchoolYear(pendingYear) : '';
  const currentLabel = formatSchoolYear(selectedYear);
  const confirming = pendingYear !== null && pendingYear !== selectedYear;

  return (
    <Modal
      visible={confirming}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmContainer}>
          <View style={styles.confirmIcon}>
            <MaterialCommunityIcons name="calendar-edit" size={32} color="#2563eb" />
          </View>
          <Text style={styles.confirmTitle}>Switch school year?</Text>
          <Text style={styles.confirmText}>
            You are switching from <Text style={styles.confirmStrong}>{currentLabel}</Text> to{' '}
            <Text style={styles.confirmStrong}>{pendingLabel}</Text>. Your dashboard, payments,
            attendance, and scores will reset and only show data from {pendingLabel}. Previous
            school year data will no longer appear in the app.
          </Text>
          <View style={styles.confirmButtons}>
            <TouchableOpacity
              style={[styles.confirmButton, styles.cancelButton]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, styles.switchButton]}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <Text style={styles.switchButtonText}>Switch</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Bottom-sheet selector that lets a parent switch the school year.
 * Lists the tutor's created school years plus any year a linked child is enrolled in.
 */
export function SchoolYearSelector({ visible, onClose }: SchoolYearSelectorProps) {
  const { selectedYear, setSelectedYear, availableYears } = useSchoolYear();
  const [pendingYear, setPendingYear] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!pendingYear) return;
    setSelectedYear(pendingYear);
    setPendingYear(null);
    onClose();
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>School Year</Text>
                <Text style={styles.subtitle}>
                  All school years your tutor has created are available.
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {availableYears.map((year) => {
              const isSelected = year === selectedYear;
              return (
                <TouchableOpacity
                  key={year}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => {
                    if (year === selectedYear) {
                      onClose();
                      return;
                    }
                    setPendingYear(year);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={isSelected ? 'calendar-check' : 'calendar-month-outline'}
                    size={20}
                    color={isSelected ? '#2563eb' : '#6b7280'}
                  />
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {formatSchoolYear(year)}
                  </Text>
                  {isSelected && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>CURRENT</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <SchoolYearConfirmDialog
        pendingYear={pendingYear}
        selectedYear={selectedYear}
        onConfirm={handleConfirm}
        onCancel={() => setPendingYear(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 12,
    paddingBottom: 32,
    paddingHorizontal: 20,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    maxWidth: 260,
  },
  closeButton: {
    padding: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 4,
  },
  optionSelected: {
    backgroundColor: '#eff6ff',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  optionTextSelected: {
    color: '#2563eb',
    fontWeight: '800',
  },
  currentBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  confirmContainer: {
    width: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  confirmIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmStrong: {
    fontWeight: '800',
    color: '#1f2937',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4b5563',
  },
  switchButton: {
    backgroundColor: '#2563eb',
  },
  switchButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});