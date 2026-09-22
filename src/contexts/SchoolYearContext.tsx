import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import { tuteeService } from '../services/tuteeService';
import { schoolYearService } from '../services/schoolYearService';
import { Tutee } from '../types/tutee';
import { getCurrentSchoolYear, formatSchoolYear } from '../utils/schoolYear';

interface SchoolYearContextType {
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  availableYears: string[];
  schoolYears: string[];
  displayLabel: string;
  isLoading: boolean;
}

const SchoolYearContext = createContext<SchoolYearContextType | undefined>(undefined);

const STORAGE_KEY = 'tutortrack_mobile_school_year';

function resolveYear(
  availableYears: string[],
  opts: { saved?: string | null; active?: string | null }
): string {
  const current = getCurrentSchoolYear();
  if (opts.saved && availableYears.includes(opts.saved)) return opts.saved;
  if (opts.active && availableYears.includes(opts.active)) return opts.active;
  if (availableYears.includes(current)) return current;
  return availableYears[0] || current;
}

export const SchoolYearProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const resolvedUid = user?.createdByTutorId || '';

  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [tutees, setTutees] = useState<Tutee[]>([]);
  const [selectedYear, setSelectedYearState] = useState<string>(getCurrentSchoolYear());
  const [isLoading, setIsLoading] = useState(true);

  // Load the tutor's school-year list (live) + resolve the initial selection.
  useEffect(() => {
    let cancelled = false;

    if (!resolvedUid) {
      setSchoolYears([]);
      setSelectedYearState(getCurrentSchoolYear());
      setIsLoading(false);
      return;
    }

    let selectionResolved = false;

    const unsubscribe = schoolYearService.subscribe(resolvedUid, async (years) => {
      if (cancelled) return;

      const list = years.length > 0 ? years : [getCurrentSchoolYear()];
      setSchoolYears(list);
      setIsLoading(false);

      // Resolve the initial selection only once, against the live list.
      if (selectionResolved) return;
      selectionResolved = true;

      try {
        const [saved, active] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          schoolYearService.getActive(resolvedUid),
        ]);
        if (cancelled) return;
        setSelectedYearState(resolveYear(list, { saved, active }));
      } catch (error) {
        console.error('Error resolving school year:', error);
        if (!cancelled) setSelectedYearState(resolveYear(list, {}));
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [resolvedUid]);

  // Keep the linked children list fresh so their enrolled school years stay visible.
  useEffect(() => {
    if (!resolvedUid) {
      setTutees([]);
      return;
    }
    const unsubscribe = tuteeService.subscribeAll(resolvedUid, (fetched) => {
      setTutees(fetched);
    });
    return () => unsubscribe();
  }, [resolvedUid]);

  // Mirror the tutor's created school years, expanded with any school year a
  // linked child is actually enrolled in, so students added to a newer SY
  // (e.g. 2027-28) always show up even if the tutor's list hasn't caught up.
  const availableYears = useMemo(() => {
    const years = new Set<string>(schoolYears);
    tutees.forEach((t) => (t.schoolYears || []).forEach((y) => years.add(y)));
    const list = Array.from(years).sort((a, b) => b.localeCompare(a));
    return list.length > 0 ? list : [getCurrentSchoolYear()];
  }, [schoolYears, tutees]);

  // Correct the selection if it becomes unavailable.
  useEffect(() => {
    setSelectedYearState((prev) => {
      if (availableYears.includes(prev)) return prev;
      return availableYears[0] || getCurrentSchoolYear();
    });
  }, [availableYears]);

  const setSelectedYear = useCallback((year: string) => {
    setSelectedYearState(year);
    AsyncStorage.setItem(STORAGE_KEY, year).catch((err) =>
      console.error('Error persisting school year:', err)
    );
  }, []);

  const value: SchoolYearContextType = {
    selectedYear,
    setSelectedYear,
    availableYears,
    schoolYears,
    displayLabel: formatSchoolYear(selectedYear),
    isLoading,
  };

  return <SchoolYearContext.Provider value={value}>{children}</SchoolYearContext.Provider>;
};

export const useSchoolYear = (): SchoolYearContextType => {
  const ctx = useContext(SchoolYearContext);
  if (!ctx) throw new Error('useSchoolYear must be used within SchoolYearProvider');
  return ctx;
};