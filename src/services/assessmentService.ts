import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Assessment } from '../types/assessment';

export const assessmentService = {
  subscribeAll(
    tutorId: string,
    tuteeIds: string[],
    callback: (assessments: Assessment[]) => void
  ): () => void {
    if (tuteeIds.length === 0) {
      callback([]);
      return () => {};
    }

    const assessmentsRef = collection(db, 'users', tutorId, 'assessments');
    const q = query(assessmentsRef, where('tuteeId', 'in', tuteeIds));

    return onSnapshot(q, (snapshot) => {
      const assessments = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Assessment[];
      assessments.sort((a, b) => b.date.localeCompare(a.date));
      callback(assessments);
    });
  },

  subscribeByTutee(
    tutorId: string,
    tuteeId: string,
    callback: (assessments: Assessment[]) => void
  ): () => void {
    const assessmentsRef = collection(db, 'users', tutorId, 'assessments');
    const q = query(assessmentsRef, where('tuteeId', '==', tuteeId));

    return onSnapshot(q, (snapshot) => {
      const assessments = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Assessment[];
      assessments.sort((a, b) => b.date.localeCompare(a.date));
      callback(assessments);
    });
  },
};
