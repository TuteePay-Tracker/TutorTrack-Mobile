const DAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
};

function weekdayIndex(day: unknown): number {
  const trimmed = String(day || '').trim();
  if (!trimmed) return 99;
  const cap = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  return DAY_INDEX[cap] ?? DAY_INDEX[cap.slice(0, 3)] ?? 99;
}

export function compareScheduleSlots(a: unknown, b: unknown): number {
  const aSlot = (a ?? {}) as Record<string, unknown>;
  const bSlot = (b ?? {}) as Record<string, unknown>;
  const aIdx = weekdayIndex(aSlot.day);
  const bIdx = weekdayIndex(bSlot.day);
  if (aIdx !== bIdx) return aIdx - bIdx;
  return String(aSlot.startTime || '').localeCompare(String(bSlot.startTime || ''));
}