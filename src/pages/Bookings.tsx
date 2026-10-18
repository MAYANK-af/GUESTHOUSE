import { useEffect, useState, type FormEvent } from 'react';
import { supabase, type Booking, type Guest, type Room, type BookingStatus, type PaymentStatus } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Plus, CalendarDays, ChevronLeft, ChevronRight, LogIn, LogOut, X, Loader2, Trash2, Pencil, Receipt, AlertTriangle, Sparkles } from 'lucide-react';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import { can } from '@/lib/permissions';
import { calcNights, computeInvoice, findConflict, formatINR } from '@/lib/booking';
import { BOOKING_TRANSITIONS, type BookingStatusFsm } from '@/lib/roomFsm';
import { BookingError, changeBookingStatus, createBooking, updateBooking } from '@/lib/bookingService';
import { rankRooms } from '@/lib/roomRecommender';

export default function Bookings() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canCreate = can(role, 'bookings.create');
  const canEdit = can(role, 'bookings.edit');
  const canCheckin = can(role, 'bookings.checkin');
  const canCancel = can(role, 'bookings.cancel');
  const canDelete = can(role, 'bookings.delete');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [invoiceBooking, setInvoiceBooking] = useState<Booking | null>(null);

  // form
  const [guestId, setGuestId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [status, setStatus] = useState<BookingStatus>('confirmed');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [assignedBy, setAssignedBy] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [bRes, gRes, rRes] = await Promise.all([
      supabase.from('bookings').select('*, guest:guests(*), room:rooms(*)').order('check_in_date', { ascending: false }),
      supabase.from('guests').select('*').order('first_name'),
      supabase.from('rooms').select('*').order('room_number'),
    ]);
    setBookings(bRes.data as Booking[] ?? []);
    setGuests(gRes.data as Guest[] ?? []);
    setRooms(rRes.data as Room[] ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditingBooking(null);
    setGuestId(''); setRoomId(''); setCheckIn(''); setCheckOut('');
    setStatus('confirmed'); setPaymentStatus('pending');
    setAssignedBy(profile?.full_name ?? ''); setNotes(''); setFormError(null);
    setModalOpen(true);
  }

  function openEdit(booking: Booking) {
    setEditingBooking(booking);
    setGuestId(booking.guest_id);
    setRoomId(booking.room_id);
    setCheckIn(booking.check_in_date);
    setCheckOut(booking.check_out_date);
    setStatus(booking.status);
    setPaymentStatus(booking.payment_status);
    setAssignedBy(booking.assigned_by ?? '');
    setFormError(null);
    setNotes(booking.notes ?? '');
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editingBooking) {
        await updateBooking(supabase, editingBooking.id, {
          guestId, roomId, checkIn, checkOut, paymentStatus,
          assignedBy: assignedBy || null, notes: notes || null,
        });
        if (status !== editingBooking.status) {
          await changeBookingStatus(supabase, editingBooking.id, status as BookingStatusFsm);
        }
      } else {
        await createBooking(supabase, {
          guestId, roomId, checkIn, checkOut, paymentStatus,
          assignedBy: assignedBy || null, notes: notes || null,
        });
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err instanceof BookingError ? err.message : 'Could not save the booking. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusUpdate(booking: Booking, newStatus: BookingStatus) {
    setPageError(null);
    try {
      await changeBookingStatus(supabase, booking.id, newStatus as BookingStatusFsm);
    } catch (err) {
      setPageError(err instanceof BookingError ? err.message : 'Could not update the booking.');
    }
    loadData();
  }

  async function handleDelete(booking: Booking) {
    if (!confirm('Delete this booking?')) return;
    await supabase.from('bookings').delete().eq('id', booking.id);
    loadData();
  }

  // Calendar helpers
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  function getBookingsForDay(day: number): Booking[] {
    const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
    return bookings.filter(b => {
      return b.check_in_date <= dateStr && b.check_out_date >= dateStr && b.status !== 'cancelled';
    });
  }

  const selectedRoom = rooms.find(r => r.id === roomId);
  const nights = calcNights(checkIn, checkOut);
  const preview = selectedRoom && nights > 0 ? computeInvoice(selectedRoom.price_per_night, nights) : null;
  const liveConflict = roomId && nights > 0 ? findConflict(bookings, roomId, checkIn, checkOut, editingBooking?.id) : undefined;
  const statusChoices: BookingStatus[] = editingBooking
    ? [editingBooking.status, ...BOOKING_TRANSITIONS[editingBooking.status as BookingStatusFsm]]
    : ['confirmed'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    confirmed: 'bg-sky-100 text-sky-700 border-l-sky-500',
    checked_in: 'bg-emerald-100 text-emerald-700 border-l-emerald-500',
    checked_out: 'bg-slate-100 text-slate-500 border-l-slate-400',
    cancelled: 'bg-red-100 text-red-700 border-l-red-500',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bookings & Reservations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage reservations and check-in/check-out</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg ring-1 ring-slate-200 overflow-hidden">
            <button onClick={() => setView('calendar')} className={`px-3 py-2 text-sm font-medium ${view === 'calendar' ? 'bg-sky-600 text-white' : 'bg-white text-slate-600'}`}>
              Calendar
            </button>
            <button onClick={() => setView('list')} className={`px-3 py-2 text-sm font-medium ${view === 'list' ? 'bg-sky-600 text-white' : 'bg-white text-slate-600'}`}>
              List
            </button>
          </div>
          {canCreate && (
            <button onClick={openAdd} className="btn-primary">
              <Plus className="w-4 h-4" />
              New Booking
            </button>
          )}
        </div>
      </div>

      {pageError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 ring-1 ring-red-200 text-red-700 text-sm px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{pageError}</span>
        </div>
      )}

      {view === 'calendar' ? (
        <div className="card p-4 sm:p-6">
          {/* Calendar header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">{monthName}</h3>
            <div className="flex gap-1">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="btn-ghost px-2 py-1">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => setCurrentMonth(new Date())} className="btn-ghost px-3 py-1 text-xs">
                Today
              </button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="btn-ghost px-2 py-1">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-slate-400 py-2">{day}</div>
            ))}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`offset-${i}`} className="min-h-[70px] sm:min-h-[100px]" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayBookings = getBookingsForDay(day);
              const isToday = new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();
              return (
                <div key={day} className={`min-h-[70px] sm:min-h-[100px] rounded-lg p-1 sm:p-1.5 border ${isToday ? 'border-sky-300 bg-sky-50/50' : 'border-slate-100'}`}>
                  <span className={`text-xs ${isToday ? 'font-bold text-sky-700' : 'text-slate-500'}`}>{day}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayBookings.slice(0, 2).map(b => (
                      <div
                        key={b.id}
                        onClick={() => (canEdit ? openEdit(b) : setInvoiceBooking(b))}
                        className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded truncate cursor-pointer border-l-2 hover:opacity-80 transition-opacity ${statusColors[b.status] ?? 'bg-slate-100'}`}
                      >
                        {b.room?.room_number} — {b.guest?.first_name}
                      </div>
                    ))}
                    {dayBookings.length > 2 && (
                      <div className="text-[10px] text-slate-400 px-1">+{dayBookings.length - 2} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100">
            {Object.entries(statusColors).map(([status, className]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${className.split(' ').find(c => c.startsWith('bg-'))}`} />
                <span className="text-xs text-slate-600 capitalize">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Reference</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Guest</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Room</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Check In</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Check Out</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Payment</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase px-4 py-3">Total (incl. GST)</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map(booking => (
                  <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-slate-700">{booking.booking_reference}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{booking.guest?.first_name} {booking.guest?.last_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{booking.room?.room_number}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(booking.check_in_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(booking.check_out_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3"><StatusBadge status={booking.status} /></td>
                    <td className="px-4 py-3"><StatusBadge status={booking.payment_status} /></td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatINR(booking.total_amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {booking.status === 'confirmed' && canCheckin && (
                          <button onClick={() => handleStatusUpdate(booking, 'checked_in')} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title="Check In" aria-label="Check In">
                            <LogIn className="w-4 h-4" />
                          </button>
                        )}
                        {booking.status === 'checked_in' && canCheckin && (
                          <button onClick={() => handleStatusUpdate(booking, 'checked_out')} className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50" title="Check Out" aria-label="Check Out">
                            <LogOut className="w-4 h-4" />
                          </button>
                        )}
                        {booking.status === 'confirmed' && canCancel && (
                          <button onClick={() => handleStatusUpdate(booking, 'cancelled')} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" title="Cancel booking" aria-label="Cancel booking">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => setInvoiceBooking(booking)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-sky-600" title="Invoice" aria-label="Invoice">
                          <Receipt className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button onClick={() => openEdit(booking)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-sky-600" title="Edit" aria-label="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(booking)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete" aria-label="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bookings.length === 0 && (
            <div className="p-12 text-center">
              <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No bookings yet. Create your first booking!</p>
            </div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingBooking ? 'Edit Booking' : 'New Booking'} maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Guest</label>
              <select required value={guestId} onChange={(e) => setGuestId(e.target.value)} className="input-field">
                <option value="">Select guest...</option>
                {guests.map(g => <option key={g.id} value={g.id}>{g.first_name} {g.last_name}</option>)}
              </select>
              {guests.length === 0 && <p className="text-xs text-amber-600 mt-1">Add guests first in the Guests page</p>}
            </div>
            <div>
              <label className="label-field">Room</label>
              <select required value={roomId} onChange={(e) => setRoomId(e.target.value)} className="input-field">
                <option value="">Select room...</option>
                {rooms.map(r => <option key={r.id} value={r.id} disabled={r.status === 'maintenance'}>Room {r.room_number} ({r.room_type}) — {formatINR(r.price_per_night)}/night{r.status === 'maintenance' ? ' · under maintenance' : ''}</option>)}
              </select>
            </div>
          </div>

          {/* AI Smart Room Suggestions */}
          {!editingBooking && guestId && (() => {
            const selectedGuest = guests.find(g => g.id === guestId);
            const recommendations = rankRooms(rooms, selectedGuest, bookings);
            if (!recommendations.length) return null;

            return (
              <div className="p-3 bg-gradient-to-r from-sky-50/80 to-indigo-50/80 border border-sky-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    AI Smart Room Suggestions:
                  </span>
                  {selectedGuest?.company && (
                    <span className="text-[11px] text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full font-medium">
                      Tariff Policy: {selectedGuest.company}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recommendations.slice(0, 2).map((rec) => (
                    <button
                      key={rec.room.id}
                      type="button"
                      onClick={() => setRoomId(rec.room.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        roomId === rec.room.id
                          ? 'border-sky-500 bg-white shadow-sm ring-1 ring-sky-500'
                          : 'border-slate-200/80 bg-white/80 hover:bg-white hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          Room {rec.room.room_number} ({rec.room.room_type})
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          rec.isTopPick ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                        }`}>
                          {rec.score}% Match
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {rec.reasons[0]}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-700 mt-1">
                        {formatINR(rec.room.price_per_night)}/night
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Check-in Date</label>
              <input type="date" required value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label-field">Check-out Date</label>
              <input type="date" required value={checkOut} min={checkIn} onChange={(e) => setCheckOut(e.target.value)} className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Booking Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)} disabled={!editingBooking || statusChoices.length < 2} className="input-field">
                {statusChoices.map(st => <option key={st} value={st}>{st.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">Payment Status</label>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)} className="input-field">
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Assigned By (Employee)</label>
              <input type="text" value={assignedBy} onChange={(e) => setAssignedBy(e.target.value)} className="input-field" placeholder="Employee name" />
            </div>
            <div />
          </div>

          {liveConflict && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-amber-50 ring-1 ring-amber-200 text-amber-800 text-sm px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Room already booked {liveConflict.check_in_date} to {liveConflict.check_out_date} ({liveConflict.booking_reference}).</span>
            </div>
          )}

          {preview && (
            <div data-testid="price-preview" className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">{preview.nights} night{preview.nights > 1 ? 's' : ''} × {formatINR(selectedRoom!.price_per_night)}</span><span>{formatINR(preview.subtotal, true)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">GST @ {Math.round(preview.rate * 100)}%</span><span>{formatINR(preview.gst, true)}</span></div>
              <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-1"><span>Total</span><span>{formatINR(preview.total, true)}</span></div>
            </div>
          )}

          {formError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 ring-1 ring-red-200 text-red-700 text-sm px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="label-field">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field min-h-[60px] resize-y" placeholder="Special requests..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingBooking ? 'Save Changes' : 'Create Booking'}
            </button>
          </div>
        </form>
      </Modal>
      <Modal open={!!invoiceBooking} onClose={() => setInvoiceBooking(null)} title="Tax Invoice" maxWidth="max-w-lg">
        {invoiceBooking && (() => {
          const n = calcNights(invoiceBooking.check_in_date, invoiceBooking.check_out_date);
          const inv = invoiceBooking.subtotal != null
            ? { subtotal: invoiceBooking.subtotal, rate: invoiceBooking.gst_rate ?? 0, gst: invoiceBooking.gst_amount ?? 0, total: invoiceBooking.total_amount ?? 0 }
            : { subtotal: invoiceBooking.total_amount ?? 0, rate: 0, gst: 0, total: invoiceBooking.total_amount ?? 0 };
          return (
            <div data-testid="invoice" className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-mono font-medium">{invoiceBooking.booking_reference}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Guest</span><span>{invoiceBooking.guest?.first_name} {invoiceBooking.guest?.last_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Room</span><span>{invoiceBooking.room?.room_number} ({invoiceBooking.room?.room_type})</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Stay</span><span>{invoiceBooking.check_in_date} → {invoiceBooking.check_out_date} ({n} night{n > 1 ? 's' : ''})</span></div>
              <div className="border-t border-slate-200 pt-3 space-y-1">
                <div className="flex justify-between"><span>Room charges</span><span>{formatINR(inv.subtotal, true)}</span></div>
                <div className="flex justify-between"><span>GST @ {Math.round(inv.rate * 100)}%</span><span>{formatINR(inv.gst, true)}</span></div>
                <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2"><span>Total payable</span><span>{formatINR(inv.total, true)}</span></div>
              </div>
              <div className="flex justify-between items-center"><span className="text-slate-500">Payment</span><StatusBadge status={invoiceBooking.payment_status} /></div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
