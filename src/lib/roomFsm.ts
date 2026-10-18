// Room lifecycle as a deterministic finite state machine.
export type RoomStatus = 'available' | 'reserved' | 'occupied' | 'cleaning' | 'maintenance';

export const ROOM_STATUSES: RoomStatus[] = ['available', 'reserved', 'occupied', 'cleaning', 'maintenance'];

export const ROOM_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  available: ['reserved', 'occupied', 'maintenance'],
  reserved: ['available', 'occupied', 'maintenance'],
  occupied: ['cleaning', 'maintenance'], // an occupied room can never jump straight to available: it must be cleaned
  cleaning: ['available', 'maintenance'],
  maintenance: ['available', 'cleaning'],
};

export function canTransition(from: RoomStatus, to: RoomStatus): boolean {
  return ROOM_TRANSITIONS[from]?.includes(to) ?? false;
}

export type BookingStatusFsm = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
export const BOOKING_TRANSITIONS: Record<BookingStatusFsm, BookingStatusFsm[]> = {
  confirmed: ['checked_in', 'cancelled'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: [],
};
export function canBookingTransition(from: BookingStatusFsm, to: BookingStatusFsm): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}
