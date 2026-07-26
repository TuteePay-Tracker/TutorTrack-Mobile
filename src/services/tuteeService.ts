import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { Tutee } from '../types/tutee';

export const tuteeService = {
  subscribeAll(tutorId: string, callback: (tutees: Tutee[]) => void): () => void {
    const tuteesRef = collection(db, 'users', tutorId, 'tutees');
    const q = query(tuteesRef, where('parentId', '==', auth.currentUser?.uid));

    return onSnapshot(q, (snapshot) => {
      const tutees = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Tutee[];
      callback(tutees);
    });
  },

  async getById(tuteeId: string, tutorId: string): Promise<Tutee | null> {
    const docRef = doc(db, 'users', tutorId, 'tutees', tuteeId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Tutee;
    }
    return null;
  },
};
