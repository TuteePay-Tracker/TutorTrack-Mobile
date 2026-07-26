export interface User {
  id: string;
  email: string;
  name: string;
  role: 'tutor' | 'parent';
  mustChangePassword?: boolean;
  linkedStudentIds?: string[];
  createdByTutorId?: string;
  contactNumber?: string;
  photoUrl?: string;
  paymentMethods?: {
    gcash?: { qrUrl?: string; accountName?: string; accountNumber?: string; enabled: boolean };
    maya?: { qrUrl?: string; accountName?: string; accountNumber?: string; enabled: boolean };
    bank?: { qrUrl?: string; accountName?: string; accountNumber?: string; bankName?: string; enabled: boolean };
    other?: { qrUrl?: string; accountName?: string; accountNumber?: string; bankName?: string; instructions?: string; enabled: boolean };
  };
}
