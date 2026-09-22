import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSchoolYear } from '../contexts/SchoolYearContext';
import { formatSchoolYear } from '../utils/schoolYear';
import { SchoolYearConfirmDialog } from './SchoolYearSelector';

/**
 * Mini school-year switcher for the dashboard header. The blue chip toggles an
 * anchored dropdown listing the tutor's school years; picking one goes through
 * the centered confirm dialog before applying.
 */
export function SchoolYearDropdown() {
  const { selectedYear, setSelectedYear, availableYears, displayLabel } = useSchoolYear();
  const [open, setOpen] = useState(false);
  const [pendingYear, setPendingYear] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!pendingYear) return;
    setSelectedYear(pendingYear);
    setPendingYear(null);
    setOpen(false);
  };

  return (
    <>
      <View style={styles.wrap}>
        <TouchableOpacity
          style={styles.chip}
          onPress={() => setOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="calendar-range" size={16} color="#ffffff" />
          <Text style={styles.chipText}>{displayLabel}</Text>
          <MaterialCommunityIcons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#ffffff"
          />
        </TouchableOpacity>

        {open && (
          <View style={styles.menu}>
            <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
              {availableYears.map((year) => {
                const isSelected = year === selectedYear;
                return (
                  <TouchableOpacity
                    key={year}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => {
                      if (year === selectedYear) {
                        setOpen(false);
                        return;
                      }
                      setPendingYear(year);
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={isSelected ? 'calendar-check' : 'calendar-month-outline'}
                      size={18}
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
            </ScrollView>
          </View>
        )}
      </View>

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
  wrap: {
    position: 'relative',
    zIndex: 50,
    elevation: 50,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chipText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  menu: {
    position: 'absolute',
    top: 44,
    right: 0,
    width: 210,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  menuScroll: {
    maxHeight: 220,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionSelected: {
    backgroundColor: '#eff6ff',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  optionTextSelected: {
    color: '#2563eb',
    fontWeight: '800',
  },
  currentBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9,
  },
  currentBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
});