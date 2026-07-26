import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig';

export interface PaymentTransaction {
  id: string;
  tuteeId: string;
  tuteeName: string;
  paymentDate: string;
  daysPaid: Array<{ date: string; amountDue: number; amountPaid: number; status: string }>;
  totalAmount: number;
  paymentMethod: string;
  month?: string;
  notes?: string;
  createdAt: any;
}

export const paymentService = {
  subscribeTransactionsByTutee(
    tutorId: string,
    tuteeId: string,
    callback: (total: number) => void
  ): () => void {
    const transactionsRef = collection(db, 'users', tutorId, 'paymentTransactions');
    const q = query(transactionsRef, where('tuteeId', '==', tuteeId));

    return onSnapshot(q, (snapshot) => {
      const total = snapshot.docs.reduce((sum, docSnap) => {
        const data = docSnap.data();
        return sum + (typeof data.totalAmount === 'number' ? data.totalAmount : 0);
      }, 0);
      callback(total);
    });
  },

  subscribeTransactionsByTuteeList(
    tutorId: string,
    tuteeId: string,
    callback: (transactions: PaymentTransaction[]) => void
  ): () => void {
    const transactionsRef = collection(db, 'users', tutorId, 'paymentTransactions');
    const q = query(transactionsRef, where('tuteeId', '==', tuteeId));

    return onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as PaymentTransaction[];
      transactions.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
      callback(transactions);
    });
  },

  subscribeAttendanceByTutee(
    tutorId: string,
    tuteeId: string,
    callback: (attendance: { presentCount: number; totalSessions: number }) => void
  ): () => void {
    const recordsRef = collection(db, 'users', tutorId, 'paymentRecords');
    const q = query(recordsRef, where('tuteeId', '==', tuteeId));

    return onSnapshot(q, (snapshot) => {
      let present = 0;
      let total = 0;
      snapshot.docs.forEach((docSnap) => {
        const recData = docSnap.data();
        const dayPayments = (recData.dayPayments || []) as any[];
        dayPayments.forEach((dp: any) => {
          if (dp.status === 'paid') present++;
          if (dp.status !== 'no-class') total++;
        });
      });
      callback({ presentCount: present, totalSessions: total });
    });
  },
};
