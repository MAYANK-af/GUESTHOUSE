import { describe, it, expect } from 'vitest';
import { processCopilotQuery, extractIdDocument } from '@/lib/aiService';
import type { Room, Guest, Booking } from '@/lib/supabase';

const mockRooms: Room[] = [
  { id: 'rm-101', room_number: '101', room_type: 'standard', floor: 1, status: 'occupied', price_per_night: 2499, notes: null, created_at: '' },
  { id: 'rm-203', room_number: '203', room_type: 'deluxe', floor: 2, status: 'cleaning', price_per_night: 4499, notes: null, created_at: '' },
  { id: 'rm-301', room_number: '301', room_type: 'executive', floor: 3, status: 'available', price_per_night: 5499, notes: null, created_at: '' },
  { id: 'rm-401', room_number: '401', room_type: 'presidential', floor: 4, status: 'available', price_per_night: 8999, notes: null, created_at: '' },
];

const mockGuests: Guest[] = [
  { id: 'gst-1', first_name: 'Aarav', last_name: 'Sharma', email: 'aarav@tcs.com', phone: '+91 98201 11000', address: 'Mumbai', id_type: 'aadhaar', id_number: '503892014768', company: 'TCS', created_at: '' },
];

const mockBookings: Booking[] = [
  {
    id: 'bk-1',
    guest_id: 'gst-1',
    room_id: 'rm-101',
    check_in_date: '2026-10-18',
    check_out_date: '2026-10-21',
    status: 'checked_in',
    booking_reference: 'GH-IN-1001',
    assigned_by: null,
    subtotal: 7497,
    gst_rate: 0.05,
    gst_amount: 374.85,
    total_amount: 7871.85,
    payment_status: 'pending',
    notes: null,
    created_at: '',
  },
];

describe('AI Copilot Query Processor (processCopilotQuery)', () => {
  it('correctly calculates GST inquiries for arbitrary prices', async () => {
    const res = await processCopilotQuery('What is the GST for 8000?', { rooms: mockRooms, guests: mockGuests, bookings: mockBookings });
    expect(['gst_inquiry', 'general_reply']).toContain(res.action);
    expect(res.message).toContain('18%');
  });

  it('detects mark clean instruction for a room', async () => {
    const res = await processCopilotQuery('Mark room 203 clean', { rooms: mockRooms, guests: mockGuests, bookings: mockBookings });
    expect(res.action).toBe('set_room_status');
    expect((res.data as any).roomNumber).toBe('203');
  });

  it('detects placing room under maintenance with a custom reason', async () => {
    const res = await processCopilotQuery('Put room 301 in maintenance due to AC servicing', { rooms: mockRooms, guests: mockGuests, bookings: mockBookings });
    expect(res.action).toBe('set_room_status');
    expect((res.data as any).roomNumber).toBe('301');
    expect((res.data as any).nextStatus).toBe('maintenance');
    expect((res.data as any).note.toLowerCase()).toContain('ac servicing');
  });

  it('detects check out instruction for an active guest', async () => {
    const res = await processCopilotQuery('Check out Aarav Sharma', { rooms: mockRooms, guests: mockGuests, bookings: mockBookings });
    expect(res.action).toBe('change_booking_status');
    expect((res.data as any).bookingId).toBe('bk-1');
    expect((res.data as any).nextStatus).toBe('checked_out');
  });

  it('answers who is in a room', async () => {
    const res = await processCopilotQuery('Who is in room 101?', { rooms: mockRooms, guests: mockGuests, bookings: mockBookings });
    expect(res.action).toBe('general_reply');
    expect(res.message).toContain('Aarav Sharma');
  });

  it('extracts ID document with high confidence', async () => {
    const doc = await extractIdDocument('', 'aadhaar');
    expect(doc.id_type).toBe('aadhaar');
    expect(doc.id_number).toBe('503892014768');
    expect(doc.confidence).toBeGreaterThan(0.9);
  });

  it('handles multi-turn booking with date normalization (DD/MM/YY) and on-the-fly guest', async () => {
    const history = [
      { role: 'user' as const, text: 'THEN BOOK ROOM 401' },
      { role: 'assistant' as const, text: 'Ready to prepare booking for Room 401. Please provide guest name and dates.' },
    ];
    const res = await processCopilotQuery(
      'MAYANK CHECK IN date 10/11/26 to 13/11/26 payment status is pending',
      { rooms: mockRooms, guests: mockGuests, bookings: mockBookings },
      history,
    );
    expect(res.action).toBe('create_booking');
    const data = res.data as any;
    expect(data.checkIn).toBe('2026-11-10');
    expect(data.checkOut).toBe('2026-11-13');
    expect(data.paymentStatus).toBe('pending');
    expect(data.roomId === 'rm-401' || data.roomNumber === '401' || data.roomId === '401').toBe(true);
    expect(data.newGuest?.first_name.toLowerCase()).toBe('mayank');
  });
});
