// Indian guest identity-document validation (Aadhaar with Verhoeff checksum, PAN, passport, DL, voter ID).
export type IdType = 'aadhaar' | 'pan' | 'passport' | 'driving_license' | 'voter_id' | 'other';

export const ID_TYPES: { value: IdType; label: string; hint: string }[] = [
  { value: 'aadhaar', label: 'Aadhaar', hint: '12 digits' },
  { value: 'pan', label: 'PAN Card', hint: '10 chars (e.g. ABCDE1234F)' },
  { value: 'passport', label: 'Passport', hint: 'e.g. K1234567' },
  { value: 'driving_license', label: 'Driving Licence', hint: 'e.g. RJ14 20110012345' },
  { value: 'voter_id', label: 'Voter ID (EPIC)', hint: 'e.g. ABC1234567' },
  { value: 'other', label: 'Other', hint: 'any government ID' },
];

// Verhoeff tables
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

export function verhoeffValid(num: string): boolean {
  let c = 0;
  const digits = num.split('').reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = D[c][P[i % 8][digits[i]]];
  return c === 0;
}

/** Generates the Verhoeff check digit for a numeric string (used for test data). */
export function verhoeffCheckDigit(num: string): number {
  let c = 0;
  const digits = num.split('').reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = D[c][P[(i + 1) % 8][digits[i]]];
  return INV[c];
}

export function normalizeId(type: IdType, value: string): string {
  const v = (value ?? '').trim();
  if (type === 'aadhaar') return v.replace(/[\s-]/g, '');
  if (type === 'other') return v;
  return v.replace(/[\s-]/g, '').toUpperCase();
}

/** Returns null when valid, otherwise a human-readable error. */
export function validateId(type: IdType, value: string): string | null {
  const v = normalizeId(type, value);
  if (!v) return 'ID number is required';
  switch (type) {
    case 'aadhaar':
      if (!/^[2-9]\d{11}$/.test(v)) return 'Aadhaar must be 12 digits and cannot start with 0 or 1';
      if (!verhoeffValid(v)) return 'Aadhaar number failed checksum validation';
      return null;
    case 'pan':
      return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v) ? null : 'PAN format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)';
    case 'passport':
      return /^[A-PR-WY][1-9]\d{6}$/.test(v) ? null : 'Passport must be 1 letter followed by 7 digits (e.g. K1234567)';
    case 'driving_license':
      return /^[A-Z]{2}\d{2}\d{4}\d{7}$/.test(v) ? null : 'Driving licence format: state code, RTO, year, 7 digits';
    case 'voter_id':
      return /^[A-Z]{3}\d{7}$/.test(v) ? null : 'Voter ID must be 3 letters followed by 7 digits';
    default:
      return v.length >= 4 ? null : 'ID number is too short';
  }
}

/** Masks an ID for display: only the last 4 characters are visible. */
export function maskId(type: IdType | null | undefined, value: string | null | undefined): string {
  if (!value) return '';
  const last4 = value.slice(-4);
  if (type === 'aadhaar') return `XXXX XXXX ${last4}`;
  return 'X'.repeat(Math.max(value.length - 4, 0)) + last4;
}
