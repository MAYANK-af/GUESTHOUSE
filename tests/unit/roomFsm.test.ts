import { describe, it, expect } from 'vitest';
import { ROOM_STATUSES, ROOM_TRANSITIONS, canTransition, canBookingTransition } from '@/lib/roomFsm';

describe('room finite state machine', () => {
  const legal = new Set<string>();
  for (const [from, tos] of Object.entries(ROOM_TRANSITIONS)) for (const to of tos) legal.add(`${from}>${to}`);

  it('has exactly the 5 documented states', () => {
    expect([...ROOM_STATUSES].sort()).toEqual(['available', 'cleaning', 'maintenance', 'occupied', 'reserved']);
  });
  it('canTransition agrees with the transition table for all 25 ordered pairs', () => {
    for (const a of ROOM_STATUSES) for (const b of ROOM_STATUSES) {
      expect(canTransition(a, b)).toBe(legal.has(`${a}>${b}`));
    }
  });
  it('never allows a self-transition', () => {
    for (const s of ROOM_STATUSES) expect(canTransition(s, s)).toBe(false);
  });
  it('an occupied room can never jump straight to available (must be cleaned)', () => {
    expect(canTransition('occupied', 'available')).toBe(false);
    expect(canTransition('occupied', 'cleaning')).toBe(true);
    expect(canTransition('cleaning', 'available')).toBe(true);
  });
  it('a room under maintenance or cleaning cannot be occupied or reserved', () => {
    for (const s of ['maintenance', 'cleaning'] as const) {
      expect(canTransition(s, 'occupied')).toBe(false);
      expect(canTransition(s, 'reserved')).toBe(false);
    }
  });
  it('every state is reachable from "available" (no dead states)', () => {
    const seen = new Set(['available']); const q = ['available'];
    while (q.length) for (const n of ROOM_TRANSITIONS[q.shift() as keyof typeof ROOM_TRANSITIONS]) if (!seen.has(n)) { seen.add(n); q.push(n); }
    expect(seen.size).toBe(5);
  });
  it('booking lifecycle: confirmed -> checked_in -> checked_out; terminal states stay terminal', () => {
    expect(canBookingTransition('confirmed', 'checked_in')).toBe(true);
    expect(canBookingTransition('confirmed', 'checked_out')).toBe(false);
    expect(canBookingTransition('checked_in', 'checked_out')).toBe(true);
    expect(canBookingTransition('checked_in', 'cancelled')).toBe(false);
    expect(canBookingTransition('checked_out', 'checked_in')).toBe(false);
    expect(canBookingTransition('cancelled', 'confirmed')).toBe(false);
  });
});
