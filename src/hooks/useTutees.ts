import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { tuteeService } from '../services/tuteeService';
import { Tutee } from '../types/tutee';

export const useTutees = () => {
  const { user } = useAuth();
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
      setTutees(fetchedTutees);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.createdByTutorId]);

  return { tutees, isLoading };
};
