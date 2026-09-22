import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useSchoolYear } from '../contexts/SchoolYearContext';
import { tuteeService } from '../services/tuteeService';
import { Tutee } from '../types/tutee';
import { isTuteeInSchoolYear } from '../utils/schoolYear';

export const useTutees = () => {
  const { user } = useAuth();
  const { selectedYear } = useSchoolYear();
  const [tutees, setTutees] = useState<Tutee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.createdByTutorId) {
      setTutees([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = tuteeService.subscribeAll(user.createdByTutorId, (fetchedTutees) => {
      setTutees(fetchedTutees.filter((t) => isTuteeInSchoolYear(t, selectedYear)));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.createdByTutorId, selectedYear]);

  return { tutees, isLoading };
};
