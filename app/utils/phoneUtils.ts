/**
 * Normalize Indian phone input to E.164 with +91.
 * Accepts 10 digits (optionally with leading 0 or 91) and returns +91XXXXXXXXXX.
 */
const DIGITS_ONLY = /^\d+$/;

export function normalizePhoneForIndia(value: string): string {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length >= 10 && digits.startsWith('91')) return digits.slice(-10);
  return digits.slice(-10);
}

/** Format for display: 10 digits shown; store as +91 + 10 digits internally. */
export function formatPhoneDisplay(value: string): string {
  const ten = normalizePhoneForIndia(value);
  return ten.slice(0, 10);
}

/** Return E.164 value for storage: +91 + 10 digits, or empty string if invalid. */
export function toStoredPhone(value: string): string {
  const ten = normalizePhoneForIndia(value);
  if (ten.length !== 10) return '';
  return '+91' + ten;
}

/** Validate: must be exactly 10 digits (after normalizing). */
export function isValidIndianPhone(value: string): boolean {
  const ten = normalizePhoneForIndia(value);
  return ten.length === 10 && DIGITS_ONLY.test(ten);
}
