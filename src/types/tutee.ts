export interface ScheduleItem {
  day: string;
  startTime?: string;
  endTime?: string;
  time?: string;
}

export interface Tutee {
  id: string;
  firstName: string;
  surname: string;
  subject: string;
  subjects?: string[];
  gradeLevel?: string;
  ratePerSession: number;
  schedule: ScheduleItem[] | string;
  email?: string;
  guardianNumber?: string;
  guardianEmail?: string;
  address?: string;
  parentId?: string;
  photoUrl?: string;
  archived?: boolean;
  totalSessions: number;
  totalPaid: number;
  balance: number;
  lastPaymentDate?: string;
  createdAt: any;
  updatedAt: any;
}
