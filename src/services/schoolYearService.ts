import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig';

export const schoolYearService = {
  async list(tutorId: string): Promise<string[]> {
    const syRef = collection(db, 'users', tutorId, 'schoolYears');
    const sySnap = await getDocs(syRef);
    const years = sySnap.docs.map((d) => d.id).sort((a, b) => b.localeCompare(a));
    return years;
  },

  subscribe(tutorId: string, callback: (years: string[]) => void): () => void {
    const syRef = collection(db, 'users', tutorId, 'schoolYears');
    return onSnapshot(syRef, (snapshot) => {
      const years = snapshot.docs.map((d) => d.id).sort((a, b) => b.localeCompare(a));
      callback(years);
    });
  },

  async getActive(tutorId: string): Promise<string | undefined> {
    const tutorSnap = await getDoc(doc(db, 'users', tutorId));
    if (tutorSnap.exists()) {
      return tutorSnap.data().activeSchoolYear as string | undefined;
    }
    return undefined;
  },
};