import { describe, it, expect } from 'vitest';
import { validateId, maskId, normalizeId, verhoeffValid, verhoeffCheckDigit } from '@/lib/identity';

describe('Aadhaar (Verhoeff checksum)', () => {
  it('accepts checksum-valid numbers, with or without spaces', () => {
    expect(validateId('aadhaar', '298347562011')).toBeNull();
    expect(validateId('aadhaar', '2983 4756 2011')).toBeNull();
    expect(validateId('aadhaar', '482150376946')).toBeNull();
  });
  it('rejects a single wrong digit', () => {
    expect(validateId('aadhaar', '298347562012')).toMatch(/checksum/);
  });
  it('rejects every single-digit substitution of a valid number (Verhoeff detects all)', () => {
    const base = '298347562011';
    let rejected = 0, tried = 0;
    for (let i = 0; i < base.length; i++) for (let d = 0; d < 10; d++) {
      if (String(d) === base[i]) continue;
      const v = base.slice(0, i) + d + base.slice(i + 1);
      if (i === 0 && (d === 0 || d === 1)) { rejected++; tried++; continue; } // leading 0/1 fails the format rule
      tried++; if (validateId('aadhaar', v) !== null) rejected++;
    }
    expect(rejected).toBe(tried);
  });
  it('rejects wrong length and leading 0/1', () => {
    expect(validateId('aadhaar', '12345')).toBeTruthy();
    expect(validateId('aadhaar', '098347562011')).toBeTruthy();
    expect(validateId('aadhaar', '198347562011')).toBeTruthy();
    expect(validateId('aadhaar', '')).toBeTruthy();
  });
  it('check-digit generator round-trips', () => {
    for (const body of ['29834756201', '48215037694', '99999999999']) {
      expect(verhoeffValid(body + verhoeffCheckDigit(body))).toBe(true);
    }
  });
});

describe('other ID types', () => {
  it('passport', () => {
    expect(validateId('passport', 'K4829105')).toBeNull();
    expect(validateId('passport', 'k4829105')).toBeNull();
    expect(validateId('passport', 'Q4829105')).toBeTruthy();
    expect(validateId('passport', 'K0829105')).toBeTruthy();
    expect(validateId('passport', 'K48291')).toBeTruthy();
  });
  it('driving licence', () => {
    expect(validateId('driving_license', 'TN0920190012345')).toBeNull();
    expect(validateId('driving_license', 'TN09 2019 0012345')).toBeNull();
    expect(validateId('driving_license', '12345')).toBeTruthy();
  });
  it('voter id', () => {
    expect(validateId('voter_id', 'MHB1234567')).toBeNull();
    expect(validateId('voter_id', 'MH12345678')).toBeTruthy();
  });
});

describe('masking & normalisation', () => {
  it('shows only the last 4 characters', () => {
    expect(maskId('aadhaar', '298347562011')).toBe('XXXX XXXX 2011');
    expect(maskId('passport', 'K4829105')).toBe('XXXX9105');
    expect(maskId('aadhaar', null)).toBe('');
  });
  it('normalises case and separators', () => {
    expect(normalizeId('aadhaar', '2983-4756-2011')).toBe('298347562011');
    expect(normalizeId('passport', ' k4829105 ')).toBe('K4829105');
  });
});
