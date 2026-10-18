// UI tests: the real <App/> rendered in jsdom against the offline engine, driven like a user would.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, waitFor, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { initMockStorage } from '@/lib/mockSupabase';

let clicks = 0;
const user = userEvent.setup();
const click = async (el: HTMLElement) => { clicks++; await user.click(el); };

async function login(who: 'Admin' | 'Staff' | 'Manager') {
  render(<App />);
  await click(await screen.findByRole('button', { name: new RegExp(who) }));
  await screen.findByText(/Room Status Overview/i);
}
const nav = (name: string) => screen.queryAllByRole('button', { name: new RegExp(`^${name}`) })[0];
async function goto(name: string) { await click(nav(name)); }
const futureDate = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

beforeEach(() => { cleanup(); localStorage.clear(); initMockStorage(); clicks = 0; }); // fresh seed data for every test

describe('role-based navigation and controls', () => {
  it('admin sees every page and the Add Room button', async () => {
    await login('Admin');
    for (const p of ['Dashboard', 'Rooms', 'Bookings', 'Guests', 'Reports', 'Notifications']) expect(nav(p)).toBeTruthy();
    await goto('Rooms');
    expect(await screen.findByRole('button', { name: /Add Room/i })).toBeInTheDocument();
  });
  it('front-desk staff: no Reports page, no Add Room, but can create bookings', async () => {
    await login('Staff');
    expect(nav('Reports')).toBeUndefined();
    await goto('Rooms');
    await screen.findByText(/Room Management/i);
    expect(screen.queryByRole('button', { name: /Add Room/i })).toBeNull();
    expect(screen.queryByLabelText(/Delete room/i)).toBeNull();
    await goto('Bookings');
    expect(await screen.findByRole('button', { name: /New Booking/i })).toBeInTheDocument();
  });
  it('duty manager: sees Reports, cannot create bookings or guests', async () => {
    await login('Manager');
    expect(nav('Reports')).toBeTruthy();
    await goto('Bookings');
    await screen.findByRole('heading', { name: /Bookings & Reservations/i });
    expect(screen.queryByRole('button', { name: /New Booking/i })).toBeNull();
    await goto('Guests');
    await screen.findByText(/Guest Management/i);
    expect(screen.queryByRole('button', { name: /Add Guest/i })).toBeNull();
  });
});

describe('room lifecycle in the UI', () => {
  it('shows all five states in the filter and renders the new Cleaning state', async () => {
    await login('Admin');
    await goto('Rooms');
    await screen.findByText(/Room 203/);
    const filter = screen.getByDisplayValue('All Statuses');
    for (const s of ['available', 'reserved', 'cleaning', 'maintenance']) {
      expect(within(filter as HTMLElement).getByRole('option', { name: new RegExp(s, 'i') })).toBeInTheDocument();
    }
    expect(screen.getAllByText('Cleaning').length).toBeGreaterThan(0);
  });
  it('staff can mark a cleaned room available, but cannot touch maintenance', async () => {
    await login('Staff');
    await goto('Rooms');
    const sel = await screen.findByLabelText('Change status of room 203');
    expect(within(sel).queryByRole('option', { name: /maintenance/i })).toBeNull();
    await user.selectOptions(sel, within(sel).getByRole('option', { name: /mark clean/i }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('gh_pro_v2_rooms')!).find((r: any) => r.room_number === '203').status).toBe('available'));
  });
  it('duty manager can put a room under maintenance', async () => {
    await login('Manager');
    await goto('Rooms');
    const sel = await screen.findByLabelText('Change status of room 102');
    await user.selectOptions(sel, within(sel).getByRole('option', { name: /maintenance/i }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('gh_pro_v2_rooms')!).find((r: any) => r.room_number === '102').status).toBe('maintenance'));
  });
});

describe('booking flow', () => {
  async function openNewBooking() {
    await goto('Bookings');
    await click(await screen.findByRole('button', { name: /New Booking/i }));
    const heading = await screen.findByText('New Booking', { selector: 'h3' });
    const modal = heading.closest('div.relative') as HTMLElement;
    const [guest, room] = within(modal).getAllByRole('combobox');
    const [cin, cout] = Array.from(modal.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    return { modal, guest, room, cin, cout };
  }
  const fill = async (f: Awaited<ReturnType<typeof openNewBooking>>, guestName: string, roomNo: string, i: string, o: string) => {
    await user.selectOptions(f.guest, within(f.guest).getByRole('option', { name: new RegExp(guestName) })); clicks++;
    await user.selectOptions(f.room, within(f.room).getByRole('option', { name: new RegExp(`Room ${roomNo} `) })); clicks++;
    fireEvent.change(f.cin, { target: { value: i } }); clicks++;
    fireEvent.change(f.cout, { target: { value: o } }); clicks++;
  };

  it('live price preview applies the 5% slab for a standard room', async () => {
    await login('Staff');
    const f = await openNewBooking();
    await fill(f, 'Aarav', '102', futureDate(30), futureDate(33));
    const p = await screen.findByTestId('price-preview');
    expect(p).toHaveTextContent('3 nights × ₹2,499');
    expect(p).toHaveTextContent('GST @ 5%');
    expect(p).toHaveTextContent('₹7,871.85');
  });
  it('live price preview applies the 18% slab for the presidential suite', async () => {
    await login('Staff');
    const f = await openNewBooking();
    await fill(f, 'Aarav', '401', futureDate(40), futureDate(42));
    const p = await screen.findByTestId('price-preview');
    expect(p).toHaveTextContent('GST @ 18%');
    expect(p).toHaveTextContent('₹21,237.64');
  });
  it('creates a booking, then BLOCKS an overlapping one with a visible error', async () => {
    await login('Staff');
    clicks = 0;
    let f = await openNewBooking();
    await fill(f, 'Aarav', '102', futureDate(30), futureDate(33));
    await click(within(f.modal).getByRole('button', { name: /Create Booking/i }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('gh_pro_v2_bookings')!).filter((b: any) => b.room_id === 'rm-102')).toHaveLength(1));
    console.log(`UI-STEPS create-booking interactions=${clicks}`);

    f = await openNewBooking();
    await fill(f, 'Priya', '102', futureDate(31), futureDate(34));
    expect(await within(f.modal).findByText(/Room already booked/i)).toBeInTheDocument(); // live warning before submit
    await click(within(f.modal).getByRole('button', { name: /Create Booking/i }));
    const alerts = await within(f.modal).findAllByRole('alert');
    expect(alerts.map((a) => a.textContent).join(' ')).toMatch(/already booked/i);
    expect(JSON.parse(localStorage.getItem('gh_pro_v2_bookings')!).filter((b: any) => b.room_id === 'rm-102')).toHaveLength(1);
  });
  it('maintenance rooms cannot be selected', async () => {
    await login('Staff');
    const f = await openNewBooking();
    expect(within(f.room).getByRole('option', { name: /Room 302/ })).toBeDisabled();
  });
  it('check-in then check-out moves room 201: reserved -> occupied -> cleaning', async () => {
    await login('Staff');
    await goto('Bookings');
    await click(await screen.findByRole('button', { name: /List/i }));
    const row = (await screen.findByText('GH-IN-1002')).closest('tr') as HTMLElement;
    await click(within(row).getByRole('button', { name: /Check In/i }));
    const rooms = () => JSON.parse(localStorage.getItem('gh_pro_v2_rooms')!);
    await waitFor(() => expect(rooms().find((r: any) => r.room_number === '201').status).toBe('occupied'));
    await click(within((await screen.findByText('GH-IN-1002')).closest('tr') as HTMLElement).getByRole('button', { name: /Check Out/i }));
    await waitFor(() => expect(rooms().find((r: any) => r.room_number === '201').status).toBe('cleaning'));
  });
  it('invoice dialog shows the GST breakdown', async () => {
    await login('Staff');
    await goto('Bookings');
    await click(await screen.findByRole('button', { name: /List/i }));
    const row = (await screen.findByText('GH-IN-1005')).closest('tr') as HTMLElement; // presidential suite
    await click(within(row).getByRole('button', { name: /Invoice/i }));
    const inv = await screen.findByTestId('invoice');
    expect(inv).toHaveTextContent('GST @ 18%');
    expect(inv).toHaveTextContent('₹21,237.64');
  });
});

describe('guest identity form', () => {
  it('rejects an Aadhaar that fails the checksum, accepts a valid one, and masks it on the card', async () => {
    await login('Staff');
    await goto('Guests');
    await click(await screen.findByRole('button', { name: /Add Guest/i }));
    const dlg = (await screen.findByText('Add New Guest', { selector: 'h3' }).catch(() => screen.findByText(/Add Guest|New Guest/i, { selector: 'h3' }))).closest('div.relative') as HTMLElement;
    const textboxes = within(dlg).getAllByRole('textbox');
    await user.type(textboxes[0], 'Test'); await user.type(textboxes[1], 'Guest');
    await user.type(within(dlg).getByLabelText('ID number'), '298347562012');
    await click(within(dlg).getByRole('button', { name: /^Add Guest$/ }));
    expect(await within(dlg).findByText(/checksum/i)).toBeInTheDocument();
    await user.clear(within(dlg).getByLabelText('ID number'));
    await user.type(within(dlg).getByLabelText('ID number'), '2983 4756 2011');
    await click(within(dlg).getByRole('button', { name: /^Add Guest$/ }));
    await waitFor(() => expect(screen.getAllByText(/XXXX XXXX 2011/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/298347562011/)).toBeNull();                      // full number never rendered
  });
});

describe('reports & CSV export', () => {
  it('exports the GST breakdown columns', async () => {
    let captured = '';
    (URL as any).createObjectURL = vi.fn((b: Blob) => { b.text().then((t) => (captured = t)); return 'blob:x'; });
    (URL as any).revokeObjectURL = vi.fn();
    await login('Admin');
    await goto('Reports');
    expect(await screen.findByText(/GST Billed/i)).toBeInTheDocument();
    await click(await screen.findByRole('button', { name: /Export CSV/i }));
    await waitFor(() => expect(captured).not.toBe(''));
    const header = captured.split('\n')[0];
    expect(header).toContain('"GST (INR)"');
    expect(header).toContain('"Total (INR)"');
    expect(captured).toMatch(/GH-IN-100[1-5]/);
  });
});
