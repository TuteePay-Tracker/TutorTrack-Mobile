import { collection, query, where, onSnapshot, addDoc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Payment, PaymentMethod } from '../types/payment';

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

  async createPaymentProof(
    data: {
      tuteeId: string;
      tuteeName: string;
      amount: number;
      sessionsCovered: number;
      paymentMethod: PaymentMethod;
      paymentDate: string;
      notes?: string;
      proofUrl: string;
      coverageType?: 'full' | 'partial';
      month?: string;
    },
    tutorId: string
  ): Promise<Payment> {
    const paymentsRef = collection(db, 'users', tutorId, 'payments');
    const now = new Date();

    const rawData: Record<string, unknown> = {
      ...data,
      status: 'pending',
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    };

    const paymentData = Object.fromEntries(
      Object.entries(rawData).filter(([, v]) => v !== undefined)
    );

    const docRef = await addDoc(paymentsRef, paymentData);

    return {
      id: docRef.id,
      ...data,
      status: 'pending',
      createdAt: now.toISOString(),
    };
  },

  subscribePaymentsByTutee(
    tutorId: string,
    tuteeId: string,
    callback: (payments: Payment[]) => void
  ): () => void {
    const paymentsRef = collection(db, 'users', tutorId, 'payments');
    const q = query(paymentsRef, where('tuteeId', '==', tuteeId));

    return onSnapshot(q, (snapshot) => {
      const payments = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      })) as Payment[];
      payments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
      callback(payments);
    });
  },

  subscribePendingAmountByTutee(
    tutorId: string,
    tuteeId: string,
    callback: (pendingTotal: number) => void
  ): () => void {
    const paymentsRef = collection(db, 'users', tutorId, 'payments');
    const q = query(paymentsRef, where('tuteeId', '==', tuteeId), where('status', '==', 'pending'));

    return onSnapshot(q, (snapshot) => {
      const total = snapshot.docs.reduce((sum, docSnap) => {
        const data = docSnap.data();
        return sum + (typeof data.amount === 'number' ? data.amount : 0);
      }, 0);
      callback(total);
    });
  },

  subscribeAllPayments(
    tutorId: string,
    tuteeIds: string[],
    callback: (payments: Payment[]) => void
  ): () => void {
    if (tuteeIds.length === 0) {
      callback([]);
      return () => {};
    }

    const paymentsRef = collection(db, 'users', tutorId, 'payments');
    const q = query(paymentsRef, where('tuteeId', 'in', tuteeIds));

    return onSnapshot(q, (snapshot) => {
      const payments = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      })) as Payment[];
      payments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
      callback(payments);
    });
  },
};
