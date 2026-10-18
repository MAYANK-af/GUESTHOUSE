import { describe, it, expect } from 'vitest';
import { calcNights, datesOverlap, findConflict, gstRateFor, computeInvoice, formatINR, round2 } from '@/lib/booking';

describe('calcNights', () => {
  it('counts whole nights', () => {
    expect(calcNights('2027-03-10', '2027-03-13')).toBe(3);
    expect(calcNights('2027-03-10', '2027-03-11')).toBe(1);
  });
  it('is not affected by month ends, leap years or DST', () => {
    expect(calcNights('2028-02-28', '2028-03-01')).toBe(2); // 2028 is a leap year
    expect(calcNights('2027-03-28', '2027-04-02')).toBe(5);
    expect(calcNights('2027-12-30', '2028-01-02')).toBe(3);
  });
  it('returns 0 for same-day, reversed or invalid input', () => {
    expect(calcNights('2027-03-10', '2027-03-10')).toBe(0);
    expect(calcNights('2027-03-10', '2027-03-09')).toBeLessThan(1);
    expect(calcNights('', '2027-03-09')).toBe(0);
    expect(calcNights('10/03/2027', '2027-03-12')).toBe(0);
  });
});

describe('datesOverlap / findConflict', () => {
  const existing = [
    { id: 'a', room_id: 'R1', check_in_date: '2027-03-10', check_out_date: '2027-03-13', status: 'confirmed', booking_reference: 'A' },
    { id: 'b', room_id: 'R1', check_in_date: '2027-03-20', check_out_date: '2027-03-22', status: 'cancelled', booking_reference: 'B' },
    { id: 'c', room_id: 'R2', check_in_date: '2027-03-10', check_out_date: '2027-03-13', status: 'checked_in', booking_reference: 'C' },
  ];
  const clash = (room: string, i: string, o: string, ignore?: string) => !!findConflict(existing, room, i, o, ignore);

  it('detects partial overlap at either end', () => {
    expect(clash('R1', '2027-03-12', '2027-03-15')).toBe(true);
    expect(clash('R1', '2027-03-08', '2027-03-11')).toBe(true);
  });
  it('detects a stay nested inside, and one that wraps, an existing stay', () => {
    expect(clash('R1', '2027-03-11', '2027-03-12')).toBe(true);
    expect(clash('R1', '2027-03-01', '2027-03-30')).toBe(true);
  });
  it('detects identical dates', () => {
    expect(clash('R1', '2027-03-10', '2027-03-13')).toBe(true);
  });
  it('allows same-day turnover in both directions', () => {
    expect(clash('R1', '2027-03-13', '2027-03-15')).toBe(false);
    expect(clash('R1', '2027-03-08', '2027-03-10')).toBe(false);
  });
  it('allows the same dates in a different room', () => {
    expect(clash('R3', '2027-03-10', '2027-03-13')).toBe(false);
  });
  it('ignores cancelled bookings', () => {
    expect(clash('R1', '2027-03-20', '2027-03-22')).toBe(false);
  });
  it('can ignore the booking being edited', () => {
    expect(clash('R1', '2027-03-11', '2027-03-14', 'a')).toBe(false);
  });
  it('datesOverlap is symmetric', () => {
    expect(datesOverlap('2027-01-01', '2027-01-05', '2027-01-04', '2027-01-08')).toBe(datesOverlap('2027-01-04', '2027-01-08', '2027-01-01', '2027-01-05'));
  });
  it('exhaustive check against a brute-force night-by-night model', () => {
    const nights = (i: number, o: number) => new Set(Array.from({ length: o - i }, (_, k) => i + k));
    const d = (n: number) => `2027-04-${String(n).padStart(2, '0')}`;
    let checked = 0;
    for (let a = 1; a < 12; a++) for (let b = a + 1; b <= 12; b++)
      for (let c = 1; c < 12; c++) for (let e = c + 1; e <= 12; e++) {
        const brute = [...nights(a, b)].some((n) => nights(c, e).has(n));
        expect(datesOverlap(d(a), d(b), d(c), d(e))).toBe(brute);
        checked++;
      }
    expect(checked).toBe(66 * 66); // every pair of stays inside a 12-day window
  });
});

describe('GST slabs (hotel rooms, per room per night)', () => {
  it('5% up to and including ₹7,500', () => {
    expect(gstRateFor(2499)).toBe(0.05);
    expect(gstRateFor(7500)).toBe(0.05);
  });
  it('18% above ₹7,500', () => {
    expect(gstRateFor(7501)).toBe(0.18);
    expect(gstRateFor(8999)).toBe(0.18);
  });
  it('computes subtotal, GST and total exactly (2 decimals)', () => {
    expect(computeInvoice(2499, 3)).toEqual({ nights: 3, rate: 0.05, subtotal: 7497, gst: 374.85, total: 7871.85 });
    expect(computeInvoice(3999, 2)).toEqual({ nights: 2, rate: 0.05, subtotal: 7998, gst: 399.9, total: 8397.9 });
    expect(computeInvoice(5499, 4)).toEqual({ nights: 4, rate: 0.05, subtotal: 21996, gst: 1099.8, total: 23095.8 });
    expect(computeInvoice(8999, 2)).toEqual({ nights: 2, rate: 0.18, subtotal: 17998, gst: 3239.64, total: 21237.64 });
  });
  it('avoids floating-point drift', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(computeInvoice(1234.56, 3).total).toBe(round2(1234.56 * 3 * 1.05));
  });
});

describe('formatINR', () => {
  it('uses the Indian digit grouping', () => {
    expect(formatINR(100000)).toBe('₹1,00,000');
    expect(formatINR(1234567.5, true)).toBe('₹12,34,567.50');
    expect(formatINR(null)).toBe('₹0');
  });
});
