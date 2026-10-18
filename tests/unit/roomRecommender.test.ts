import { describe, it, expect } from 'vitest';
import { rankRooms } from '@/lib/roomRecommender';
import type { Room, Guest, Booking } from '@/lib/supabase';

const mockRooms: Room[] = [
  { id: 'r1', room_number: '101', room_type: 'standard', floor: 1, status: 'available', price_per_night: 2499, notes: 'Ground floor', created_at: '' },
  { id: 'r2', room_number: '201', room_type: 'deluxe', floor: 2, status: 'available', price_per_night: 3999, notes: 'Balcony', created_at: '' },
  { id: 'r3', room_number: '301', room_type: 'executive', floor: 3, status: 'available', price_per_night: 5499, notes: 'Desk included', created_at: '' },
  { id: 'r4', room_number: '302', room_type: 'executive', floor: 3, status: 'maintenance', price_per_night: 5499, notes: null, created_at: '' },
  { id: 'r5', room_number: '401', room_type: 'presidential', floor: 4, status: 'available', price_per_night: 8999, notes: 'Terrace', created_at: '' },
];

const mockGuest: Guest = {
  id: 'g1',
  first_name: 'Aarav',
  last_name: 'Sharma',
  email: 'aarav@tcs.com',
  phone: '+91 98201 11000',
  address: 'Mumbai',
  id_type: 'aadhaar',
  id_number: '503892014768',
  company: 'Tata Consultancy Services',
  created_at: '',
};

describe('Smart Room Suggestion Engine (rankRooms)', () => {
  it('excludes rooms currently under maintenance', () => {
    const ranked = rankRooms(mockRooms, mockGuest, []);
    const roomNumbers = ranked.map((r) => r.room.room_number);
    expect(roomNumbers).not.toContain('302');
  });

  it('prioritizes rooms within corporate budget policy', () => {
    // TCS has a default limit of 6,000 INR
    const ranked = rankRooms(mockRooms, mockGuest, []);
    const topPick = ranked[0];
    expect(topPick.room.price_per_night).toBeLessThanOrEqual(6000);
    expect(topPick.corporatePolicyStatus).toBe('approved');
  });

  it('boosts rank when guest previously stayed in that room', () => {
    const previousBookings: Booking[] = [
      {
        id: 'b1',
        guest_id: 'g1',
        room_id: 'r3',
        check_in_date: '2026-10-01',
        check_out_date: '2026-10-04',
        status: 'checked_out',
        booking_reference: 'GH-101',
        assigned_by: null,
        subtotal: 16497,
        gst_rate: 0.05,
        gst_amount: 824.85,
        total_amount: 17321.85,
        payment_status: 'paid',
        notes: null,
        created_at: '',
      },
    ];

    const ranked = rankRooms(mockRooms, mockGuest, previousBookings);
    expect(ranked[0].room.id).toBe('r3');
    expect(ranked[0].reasons.some((reason) => reason.includes('previously stayed in Room 301'))).toBe(true);
  });
});
