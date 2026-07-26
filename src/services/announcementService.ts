import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Announcement } from '../types/announcement';

export const announcementService = {
  subscribe(tutorId: string, callback: (announcements: Announcement[]) => void): () => void {
    const announcementsRef = collection(db, 'users', tutorId, 'announcements');
    const q = query(announcementsRef, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const announcements = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Announcement[];
      callback(announcements);
    });
  },
};
