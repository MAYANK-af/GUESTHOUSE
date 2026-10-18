// Business-logic layer between the UI and the database client (Supabase or the offline mock engine).
// Every mutation that touches a room or booking goes through here so that the rules
// (collision check, room FSM, GST invoice, notifications) are enforced in ONE place.
import { calcNights, computeInvoice, findConflict, todayISO } from './booking';
import { canBookingTransition, canTransition, type BookingStatusFsm, type RoomStatus } from './roomFsm';

export type BookingErrorCode =
  | 'INVALID_DATES' | 'NOT_FOUND' | 'ROOM_NOT_BOOKABLE' | 'CONFLICT' | 'INVALID_TRANSITION' | 'DB';

export class BookingError extends Error {
  code: BookingErrorCode;
  constructor(code: BookingErrorCode, message: string) {
    super(message);
    this.name = 'BookingError';
    this.code = code;
  }
}

type Db = any;

function dbFail(error: any): never {
  // 23P01 = exclusion_violation (the database-level double-booking guard)
  if (error?.code === '23P01') throw new BookingError('CONFLICT', 'This room is already booked for the selected dates.');
  throw new BookingError('DB', error?.message ?? 'Database error');
}

async function getRoom(db: Db, id: string) {
  const { data, error } = await db.from('rooms').select('*').eq('id', id).maybeSingle();
  if (error) dbFail(error);
  if (!data) throw new BookingError('NOT_FOUND', 'Room not found');
  return data;
}

async function notify(db: Db, type: string, title: string, message: string, bookingId: string | null = null) {
  await db.from('notifications').insert({ type, title, message, recipient: 'all', booking_id: bookingId });
}

export interface BookingInput {
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  assignedBy?: string | null;
  paymentStatus?: 'pending' | 'paid' | 'partial';
  notes?: string | null;
}

function validateDates(checkIn: string, checkOut: string) {
  if (calcNights(checkIn, checkOut) < 1) {
    throw new BookingError('INVALID_DATES', 'Check-out must be at least one night after check-in.');
  }
}

async function assertNoConflict(db: Db, roomId: string, checkIn: string, checkOut: string, ignoreId?: string) {
  const { data, error } = await db.from('bookings').select('*').eq('room_id', roomId);
  if (error) dbFail(error);
  const clash = findConflict((data ?? []) as any[], roomId, checkIn, checkOut, ignoreId);
  if (clash) {
    throw new BookingError(
      'CONFLICT',
      `Room is already booked from ${clash.check_in_date} to ${clash.check_out_date} (${clash.booking_reference}).`,
    );
  }
}

export async function createBooking(db: Db, input: BookingInput) {
  validateDates(input.checkIn, input.checkOut);
  const room = await getRoom(db, input.roomId);
  if (room.status === 'maintenance') {
    throw new BookingError('ROOM_NOT_BOOKABLE', `Room ${room.room_number} is under maintenance and cannot be booked.`);
  }
  await assertNoConflict(db, input.roomId, input.checkIn, input.checkOut);

  const inv = computeInvoice(Number(room.price_per_night), calcNights(input.checkIn, input.checkOut));
  const { data, error } = await db
    .from('bookings')
    .insert({
      guest_id: input.guestId,
      room_id: input.roomId,
      check_in_date: input.checkIn,
      check_out_date: input.checkOut,
      status: 'confirmed',
      payment_status: input.paymentStatus ?? 'pending',
      assigned_by: input.assignedBy ?? null,
      subtotal: inv.subtotal,
      gst_rate: inv.rate,
      gst_amount: inv.gst,
      total_amount: inv.total,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) dbFail(error);

  // Hold the room only when the stay starts today; future stays are protected by the date-overlap check.
  if (input.checkIn <= todayISO() && room.status === 'available') {
    await db.from('rooms').update({ status: 'reserved' }).eq('id', room.id);
  }
  await notify(db, 'booking_confirmation', 'New Booking Created', `Booking ${data.booking_reference} for Room ${room.room_number}`, data.id);
  return data;
}

export type BookingPatch = Partial<BookingInput>;

/** Edits the stay details (room / dates / guest / payment / notes). Re-validates and re-prices. */
export async function updateBooking(db: Db, id: string, patch: BookingPatch) {
  const { data: cur, error } = await db.from('bookings').select('*').eq('id', id).maybeSingle();
  if (error) dbFail(error);
  if (!cur) throw new BookingError('NOT_FOUND', 'Booking not found');

  const roomId = patch.roomId ?? cur.room_id;
  const checkIn = patch.checkIn ?? cur.check_in_date;
  const checkOut = patch.checkOut ?? cur.check_out_date;
  validateDates(checkIn, checkOut);
  const room = await getRoom(db, roomId);
  if (roomId !== cur.room_id && room.status === 'maintenance') {
    throw new BookingError('ROOM_NOT_BOOKABLE', `Room ${room.room_number} is under maintenance and cannot be booked.`);
  }
  await assertNoConflict(db, roomId, checkIn, checkOut, id);

  const inv = computeInvoice(Number(room.price_per_night), calcNights(checkIn, checkOut));
  const { data, error: upErr } = await db
    .from('bookings')
    .update({
      guest_id: patch.guestId ?? cur.guest_id,
      room_id: roomId,
      check_in_date: checkIn,
      check_out_date: checkOut,
      payment_status: patch.paymentStatus ?? cur.payment_status,
      assigned_by: patch.assignedBy ?? cur.assigned_by,
      notes: patch.notes === undefined ? cur.notes : patch.notes,
      subtotal: inv.subtotal,
      gst_rate: inv.rate,
      gst_amount: inv.gst,
      total_amount: inv.total,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (upErr) dbFail(upErr);
  return data;
}

/** confirmed -> checked_in | cancelled ; checked_in -> checked_out. Drives the room FSM as a side effect. */
export async function changeBookingStatus(db: Db, bookingId: string, next: BookingStatusFsm) {
  const { data: b, error } = await db
    .from('bookings')
    .select('*, guest:guests(*), room:rooms(*)')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) dbFail(error);
  if (!b) throw new BookingError('NOT_FOUND', 'Booking not found');
  if (!canBookingTransition(b.status, next)) {
    throw new BookingError('INVALID_TRANSITION', `A ${b.status.replace('_', ' ')} booking cannot become ${next.replace('_', ' ')}.`);
  }
  const room = await getRoom(db, b.room_id);
  const guestName = `${b.guest?.first_name ?? ''} ${b.guest?.last_name ?? ''}`.trim();

  if (next === 'checked_in') {
    if (!canTransition(room.status, 'occupied')) {
      throw new BookingError('INVALID_TRANSITION', `Room ${room.room_number} is ${room.status} and cannot be checked into.`);
    }
    await db.from('rooms').update({ status: 'occupied' }).eq('id', room.id);
    await notify(db, 'check_in_alert', 'Guest Checked In', `${guestName} checked in to Room ${room.room_number}`, b.id);
  } else if (next === 'checked_out') {
    await db.from('rooms').update({ status: 'cleaning' }).eq('id', room.id); // occupied -> cleaning, never straight to available
    await notify(db, 'check_out_alert', 'Guest Checked Out', `${guestName} checked out of Room ${room.room_number}; housekeeping required`, b.id);
  } else if (next === 'cancelled' && room.status === 'reserved') {
    await db.from('rooms').update({ status: 'available' }).eq('id', room.id);
  }
  const { error: upErr } = await db.from('bookings').update({ status: next }).eq('id', b.id);
  if (upErr) dbFail(upErr);
}

/** Manual room status change (maintenance, mark clean, ...). Rejects transitions the FSM forbids. */
export async function setRoomStatus(db: Db, roomId: string, next: RoomStatus, note?: string) {
  const room = await getRoom(db, roomId);
  if (room.status === next) return room;
  if (!canTransition(room.status, next)) {
    throw new BookingError('INVALID_TRANSITION', `Room ${room.room_number}: ${room.status} -> ${next} is not allowed.`);
  }
  const patch: any = { status: next };
  if (next === 'maintenance' && note) patch.notes = note;
  const { error } = await db.from('rooms').update(patch).eq('id', roomId);
  if (error) dbFail(error);
  if (next === 'maintenance') {
    await notify(db, 'maintenance', 'Maintenance Logged', `Room ${room.room_number} placed out of order.${note ? ' ' + note : ''}`);
  }
  return { ...room, ...patch };
}
