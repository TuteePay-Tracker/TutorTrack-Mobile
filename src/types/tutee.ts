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
  /** School years this student is enrolled in, e.g. ["2025-26", "2026-27"]. */
  schoolYears?: string[];
  /** School years in which this student is archived (per-year archive state). */
  archivedForYears?: string[];
  /** Per-school-year financial rollups maintained by the web app's syncTuteeTotals. */
  totalsByYear?: Record<
    string,
    { totalSessions: number; totalPaid: number; balance: number; lastPaymentDate?: string }
  >;
  totalSessions: number;
  totalPaid: number;
  balance: number;
  lastPaymentDate?: string;
  createdAt: any;
  updatedAt: any;
}
