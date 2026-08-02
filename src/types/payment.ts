export type PaymentMethod = 'Cash' | 'GCash' | 'Bank Transfer' | 'PayMaya' | 'Other';

export interface Payment {
  id: string;
  tuteeId: string;
  tuteeName: string;
  amount: number;
  sessionsCovered: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  notes?: string;
  createdAt: string;
  month?: string;
  status?: 'pending' | 'verified' | 'rejected';
  proofUrl?: string;
  coverageType?: 'full' | 'partial';
  rejectionReason?: string;
}
