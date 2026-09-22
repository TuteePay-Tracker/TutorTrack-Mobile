/**
 * School Year utilities — Philippine convention.
 * A school year runs from June 1 of year N to May 31 of year N+1.
 * Format: "2026-27" (short form of SY 2026–2027)
 */

const SCHOOL_YEAR_RE = /^\d{4}-\d{2}$/;

/** Returns the current school year string based on today's date. */
export function getCurrentSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

/** Returns the start and end Date for a given school year string. */
export function getSchoolYearRange(sy: string): { start: Date; end: Date } {
  const parts = sy.split('-');
  const startYear = parseInt(parts[0], 10);
  const endYear = startYear + 1;
  return {
    start: new Date(startYear, 5, 1, 0, 0, 0, 0),
    end: new Date(endYear, 4, 31, 23, 59, 59, 999),
  };
}

/** Formats a school year string for display. "2026-27" → "SY 2026–27" */
export function formatSchoolYear(sy: string): string {
  return `SY ${sy.replace('-', '–')}`;
}

/** Derives the school year string from a given date. */
export function getSchoolYearFromDate(date: Date | string | undefined | null): string | undefined {
  if (!date) return undefined;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return undefined;
  const startYear = d.getMonth() + 1 >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

/** Derives the school year from a "YYYY-MM" month key. */
export function getSchoolYearFromMonth(month: string | undefined | null): string | undefined {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return undefined;
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(monthNum)) return undefined;
  const startYear = monthNum >= 6 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

/** Returns true if a "YYYY-MM" month key falls within the given school year. */
export function isMonthInSchoolYear(month: string, sy: string): boolean {
  return getSchoolYearFromMonth(month) === sy;
}

function toDateInput(value: unknown): Date | string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  return undefined;
}

/**
 * True if a record belongs to the given school year.
 * Uses the explicit `schoolYear` stamp when present, otherwise derives it from
 * available date-ish fields. Records with no detectable date default to TRUE.
 */
export function belongsToSchoolYear(
  sy: string,
  record: {
    schoolYear?: string | null;
    paymentDate?: unknown;
    date?: unknown;
    createdAt?: unknown;
    month?: string | null;
  } = {}
): boolean {
  if (record.schoolYear) return record.schoolYear === sy;
  const src = toDateInput(record.paymentDate) ?? toDateInput(record.date) ?? toDateInput(record.createdAt);
  const derived = src !== undefined ? getSchoolYearFromDate(src) : undefined;
  if (derived !== undefined) return derived === sy;
  if (record.month) return getSchoolYearFromMonth(record.month) === sy;
  return true;
}

export interface TuteeYearShape {
  schoolYears?: string[];
  totalsByYear?: Record<string, { totalSessions: number; totalPaid: number; balance: number; lastPaymentDate?: string }>;
  totalSessions?: number;
  totalPaid?: number;
  balance?: number;
  lastPaymentDate?: string;
}

/**
 * True if the student is enrolled in the given school year.
 * Students without a `schoolYears` array (pre-migration) are considered enrolled.
 */
export function isTuteeInSchoolYear(tutee: Pick<TuteeYearShape, 'schoolYears'>, year: string): boolean {
  const years = tutee.schoolYears;
  if (!Array.isArray(years) || years.length === 0) return true;
  return years.includes(year);
}

/**
 * Returns a student's financial state for a given school year.
 */
export function getTuteeYearTotals(
  tutee: TuteeYearShape,
  year: string
): { totalSessions: number; totalPaid: number; balance: number; lastPaymentDate?: string } {
  if (tutee.totalsByYear && year in tutee.totalsByYear) {
    return tutee.totalsByYear[year];
  }
  if (tutee.totalsByYear && Object.keys(tutee.totalsByYear).length > 0) {
    return { totalSessions: 0, totalPaid: 0, balance: 0 };
  }
  if (Array.isArray(tutee.schoolYears) && tutee.schoolYears.length > 0) {
    return { totalSessions: 0, totalPaid: 0, balance: 0 };
  }
  return {
    totalSessions: tutee.totalSessions || 0,
    totalPaid: tutee.totalPaid || 0,
    balance: tutee.balance || 0,
    lastPaymentDate: tutee.lastPaymentDate,
  };
}