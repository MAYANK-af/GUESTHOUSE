// Pure booking / billing logic. No I/O here so it can be unit-tested directly.

/** Hotel-room GST slabs (per room, per night, on the value actually charged).
 *  Rooms up to ₹7,500 -> 5% (no ITC); rooms above ₹7,500 -> 18%.
 *  Effective 22 Sep 2025 (56th GST Council). Kept as constants so a rate change is a one-line edit. */
export const GST_THRESHOLD_PER_NIGHT = 7500;
export const GST_RATE_LOW = 0.05;
export const GST_RATE_HIGH = 0.18;

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function parseISODate(d: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d ?? '');
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole nights between two ISO dates (YYYY-MM-DD). 0 if either date is invalid. */
export function calcNights(checkIn: string, checkOut: string): number {
  const a = parseISODate(checkIn);
  const b = parseISODate(checkOut);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Half-open interval overlap [in, out). Same-day turnover (out == next in) is NOT a clash.
 *  ISO date strings compare correctly as plain strings. */
export function datesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && bIn < aOut;
}

export interface BookingLike {
  id?: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  booking_reference?: string;
}

/** Returns the first active booking of the room that overlaps the requested stay, if any. */
export function findConflict<T extends BookingLike>(
  existing: T[],
  roomId: string,
  checkIn: string,
  checkOut: string,
  ignoreId?: string,
): T | undefined {
  return existing.find(
    (b) =>
      b.id !== ignoreId &&
      b.room_id === roomId &&
      b.status !== 'cancelled' &&
      datesOverlap(checkIn, checkOut, b.check_in_date, b.check_out_date),
  );
}

export function gstRateFor(pricePerNight: number): number {
  return pricePerNight > GST_THRESHOLD_PER_NIGHT ? GST_RATE_HIGH : GST_RATE_LOW;
}

export interface Invoice {
  nights: number;
  rate: number; // 0.05 or 0.18
  subtotal: number;
  gst: number;
  total: number;
}

export function computeInvoice(pricePerNight: number, nights: number): Invoice {
  const rate = gstRateFor(pricePerNight);
  const subtotal = round2(pricePerNight * nights);
  const gst = round2(subtotal * rate);
  return { nights, rate, subtotal, gst, total: round2(subtotal + gst) };
}

export function formatINR(n: number | null | undefined, fixed = false): string {
  return '₹' + (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: fixed ? 2 : 0, maximumFractionDigits: 2 });
}

export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
