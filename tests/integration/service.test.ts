// Integration tests: business-logic service + offline (localStorage) data engine, no UI.
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockClient } from '@/lib/mockSupabase';
import { BookingError, changeBookingStatus, createBooking, setRoomStatus, updateBooking } from '@/lib/bookingService';
import { todayISO } from '@/lib/booking';

let db: any;
beforeEach(() => { localStorage.clear(); db = createMockClient(); });

const room = async (n: string) => (await db.from('rooms').select('*').eq('room_number', n).maybeSingle()).data;
const status = async (n: string) => (await room(n)).status;
const rejects = async (p: Promise<unknown>, code: string) => {
  const e: any = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(BookingError);
  expect(e.code).toBe(code);
  return e as BookingError;
};

describe('createBooking', () => {
  it('prices the stay with the correct GST slab and stores the breakdown', async () => {
    const r = await room('102'); // standard ₹2,499
    const b = await createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-05-10', checkOut: '2031-05-13' });
    expect(b).toMatchObject({ subtotal: 7497, gst_rate: 0.05, gst_amount: 374.85, total_amount: 7871.85, status: 'confirmed' });
  });
  it('uses the 18% slab for the presidential suite (₹8,999)', async () => {
    const r = await room('401');
    const b = await createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-05-10', checkOut: '2031-05-12' });
    expect(b).toMatchObject({ gst_rate: 0.18, subtotal: 17998, gst_amount: 3239.64, total_amount: 21237.64 });
  });
  it('REJECTS an overlapping booking for the same room', async () => {
    const r = await room('102');
    await createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-05-10', checkOut: '2031-05-13' });
    const e = await rejects(createBooking(db, { guestId: 'gst-2', roomId: r.id, checkIn: '2031-05-12', checkOut: '2031-05-15' }), 'CONFLICT');
    expect(e.message).toMatch(/already booked/);
    const all = (await db.from('bookings').select('*').eq('room_id', r.id)).data;
    expect(all).toHaveLength(1); // nothing was written
  });
  it('allows back-to-back (same-day turnover) bookings', async () => {
    const r = await room('102');
    await createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-05-10', checkOut: '2031-05-13' });
    await createBooking(db, { guestId: 'gst-2', roomId: r.id, checkIn: '2031-05-13', checkOut: '2031-05-15' });
    expect((await db.from('bookings').select('*').eq('room_id', r.id)).data).toHaveLength(2);
  });
  it('rejects zero-night and reversed stays', async () => {
    const r = await room('102');
    await rejects(createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-05-10', checkOut: '2031-05-10' }), 'INVALID_DATES');
    await rejects(createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-05-10', checkOut: '2031-05-08' }), 'INVALID_DATES');
  });
  it('rejects booking a room that is under maintenance', async () => {
    const r = await room('302');
    await rejects(createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-05-10', checkOut: '2031-05-12' }), 'ROOM_NOT_BOOKABLE');
  });
  it('holds the room (reserved) only when the stay starts today', async () => {
    const r = await room('102');
    await createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-05-10', checkOut: '2031-05-12' });
    expect(await status('102')).toBe('available');
    const r3 = await room('103');
    const t = new Date(); t.setDate(t.getDate() + 2);
    await createBooking(db, { guestId: 'gst-1', roomId: r3.id, checkIn: todayISO(), checkOut: todayISO(t) });
    expect(await status('103')).toBe('reserved');
  });
  it('writes a notification', async () => {
    const before = (await db.from('notifications').select('*')).data.length;
    const r = await room('102');
    await createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-05-10', checkOut: '2031-05-12' });
    const after = (await db.from('notifications').select('*')).data;
    expect(after.length).toBe(before + 1);
    expect(after.some((n: any) => n.type === 'booking_confirmation')).toBe(true);
  });
});

describe('updateBooking', () => {
  it('re-prices when the dates change and re-checks conflicts (ignoring itself)', async () => {
    const r = await room('102');
    const a = await createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-05-10', checkOut: '2031-05-12' });
    const upd = await updateBooking(db, a.id, { checkOut: '2031-05-14' });
    expect(upd).toMatchObject({ subtotal: 9996, total_amount: 10495.8 });
  });
  it('refuses to move a booking onto another booking', async () => {
    const r = await room('102');
    await createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-05-10', checkOut: '2031-05-12' });
    const b = await createBooking(db, { guestId: 'gst-2', roomId: r.id, checkIn: '2031-05-20', checkOut: '2031-05-22' });
    await rejects(updateBooking(db, b.id, { checkIn: '2031-05-11', checkOut: '2031-05-21' }), 'CONFLICT');
  });
});

describe('check-in / check-out lifecycle drives the room FSM', () => {
  it('confirmed -> checked_in makes the room occupied; checked_out sends it to CLEANING, then available', async () => {
    const bk = (await db.from('bookings').select('*').eq('booking_reference', 'GH-IN-1002').maybeSingle()).data; // room 201, reserved
    expect(await status('201')).toBe('reserved');
    await changeBookingStatus(db, bk.id, 'checked_in');
    expect(await status('201')).toBe('occupied');
    await changeBookingStatus(db, bk.id, 'checked_out');
    expect(await status('201')).toBe('cleaning');                 // never straight to "available"
    await setRoomStatus(db, (await room('201')).id, 'available');
    expect(await status('201')).toBe('available');
  });
  it('cannot check into a room that is still being cleaned or is under maintenance', async () => {
    const r = await room('203'); // cleaning in the seed data
    const b = await createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-06-01', checkOut: '2031-06-03' });
    await rejects(changeBookingStatus(db, b.id, 'checked_in'), 'INVALID_TRANSITION');
    expect(await status('203')).toBe('cleaning');
  });
  it('rejects illegal booking transitions', async () => {
    const r = await room('102');
    const b = await createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-06-01', checkOut: '2031-06-03' });
    await rejects(changeBookingStatus(db, b.id, 'checked_out'), 'INVALID_TRANSITION'); // never checked in
    await changeBookingStatus(db, b.id, 'cancelled');
    await rejects(changeBookingStatus(db, b.id, 'checked_in'), 'INVALID_TRANSITION');   // cancelled is terminal
  });
  it('cancelling frees a reserved room and the dates become bookable again', async () => {
    const r = await room('103');
    const t = new Date(); t.setDate(t.getDate() + 2);
    const b = await createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: todayISO(), checkOut: todayISO(t) });
    expect(await status('103')).toBe('reserved');
    await changeBookingStatus(db, b.id, 'cancelled');
    expect(await status('103')).toBe('available');
    await createBooking(db, { guestId: 'gst-2', roomId: r.id, checkIn: todayISO(), checkOut: todayISO(t) });
  });
});

describe('setRoomStatus (manual changes)', () => {
  it('allows available -> maintenance -> available and logs a maintenance notification', async () => {
    const r = await room('102');
    await setRoomStatus(db, r.id, 'maintenance', 'Leaking tap');
    expect(await status('102')).toBe('maintenance');
    const notes = (await db.from('notifications').select('*')).data;
    expect(notes.some((n: any) => n.type === 'maintenance' && /Room 102/.test(n.message))).toBe(true);
    await setRoomStatus(db, r.id, 'available');
    expect(await status('102')).toBe('available');
  });
  it('rejects occupied -> available (must go through cleaning)', async () => {
    const r = await room('101'); // occupied
    await rejects(setRoomStatus(db, r.id, 'available'), 'INVALID_TRANSITION');
    expect(await status('101')).toBe('occupied');
  });
  it('rejects cleaning -> occupied', async () => {
    const r = await room('203');
    await rejects(setRoomStatus(db, r.id, 'occupied'), 'INVALID_TRANSITION');
  });
});

describe('offline engine', () => {
  it('persists data across a "page reload" (new client, same localStorage)', async () => {
    const r = await room('102');
    await createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: '2031-07-01', checkOut: '2031-07-03' });
    const reloaded = createMockClient();
    const rows = (await reloaded.from('bookings').select('*').eq('room_id', r.id)).data;
    expect(rows).toHaveLength(1);
  });
  it('seed data is internally consistent: no overlaps, GST matches the slab, room states match bookings', async () => {
    const bookings = (await db.from('bookings').select('*, room:rooms(*)')).data as any[];
    const { findConflict, computeInvoice, calcNights } = await import('@/lib/booking');
    for (const b of bookings) {
      expect(findConflict(bookings, b.room_id, b.check_in_date, b.check_out_date, b.id)).toBeUndefined();
      const inv = computeInvoice(b.room.price_per_night, calcNights(b.check_in_date, b.check_out_date));
      expect(b.total_amount).toBe(inv.total);
      if (b.status === 'checked_in') expect(b.room.status).toBe('occupied');
    }
  });
});

describe('service-layer latency (mock engine, in-process)', () => {
  it('creating a booking takes well under 50 ms on average', async () => {
    const r = await room('102');
    const N = 100; const times: number[] = [];
    for (let i = 0; i < N; i++) {
      const d0 = new Date(2040, 0, 1 + i * 2); const d1 = new Date(2040, 0, 2 + i * 2);
      const t0 = performance.now();
      await createBooking(db, { guestId: 'gst-1', roomId: r.id, checkIn: todayISO(d0), checkOut: todayISO(d1) });
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const mean = times.reduce((a, b) => a + b, 0) / N;
    const p95 = times[Math.floor(N * 0.95)];
    console.log(`BENCH createBooking n=${N} mean=${mean.toFixed(2)}ms p95=${p95.toFixed(2)}ms max=${times[N - 1].toFixed(2)}ms`);
    expect(mean).toBeLessThan(50);
  });
});
