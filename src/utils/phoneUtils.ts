/**
 * Normalizes a Philippine phone number into standard 11-digit format starting with 09 (e.g., 09123456789).
 * Handles formats like +63 9XX XXX XXXX, +639XXXXXXXXX, 639XXXXXXXXX, 09XXXXXXXXX, 9XXXXXXXXX,
 * and strings containing spaces, hyphens, or parentheses.
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('639') && digits.length === 12) {
    digits = '0' + digits.slice(2);
  } else if (digits.startsWith('9') && digits.length === 10) {
    digits = '0' + digits;
  }
  return digits;
}

/**
 * Checks if a phone number is a valid 11-digit Philippine mobile number after normalization.
 */
export function isValidPHPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^09\d{9}$/.test(normalized);
}
