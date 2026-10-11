import { useEffect, useState } from 'react';
import { supabase, type Booking, type Guest, type Room } from '@/lib/supabase';
import { BarChart3, Download, Filter, Calendar, TrendingUp, IndianRupee, BedDouble, Users } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

export default function Reports() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const [monthFilter, setMonthFilter] = useState(new Date().getMonth());
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [bRes, gRes, rRes] = await Promise.all([
      supabase.from('bookings').select('*, guest:guests(*), room:rooms(*)').order('check_in_date', { ascending: false }),
      supabase.from('guests').select('*'),
      supabase.from('rooms').select('*'),
    ]);
    setBookings(bRes.data as Booking[] ?? []);
    setGuests(gRes.data as Guest[] ?? []);
    setRooms(rRes.data as Room[] ?? []);
    setLoading(false);
  }

  const employees = [...new Set(bookings.map(b => b.assigned_by).filter(Boolean))] as string[];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const filtered = bookings.filter(b => {
    const d = new Date(b.check_in_date);
    const monthMatch = d.getMonth() === monthFilter && d.getFullYear() === yearFilter;
    const employeeMatch = employeeFilter === 'all' || b.assigned_by === employeeFilter;
    const roomMatch = roomFilter === 'all' || b.room_id === roomFilter;
    return monthMatch && employeeMatch && roomMatch;
  });

  const totalRevenue = filtered.reduce((sum, b) => sum + (b.total_amount ?? 0), 0);
  const paidRevenue = filtered.filter(b => b.payment_status === 'paid').reduce((sum, b) => sum + (b.total_amount ?? 0), 0);
  const pendingRevenue = filtered.filter(b => b.payment_status === 'pending').reduce((sum, b) => sum + (b.total_amount ?? 0), 0);
  const totalNights = filtered.reduce((sum, b) => {
    const nights = Math.ceil((new Date(b.check_out_date).getTime() - new Date(b.check_in_date).getTime()) / (1000 * 60 * 60 * 24));
    return sum + nights;
  }, 0);

  // Room allocation breakdown
  const roomAllocation = rooms.map(room => {
    const roomBookings = filtered.filter(b => b.room_id === room.id);
    const nights = roomBookings.reduce((sum, b) => {
      const n = Math.ceil((new Date(b.check_out_date).getTime() - new Date(b.check_in_date).getTime()) / (1000 * 60 * 60 * 24));
      return sum + n;
    }, 0);
    const revenue = roomBookings.reduce((sum, b) => sum + (b.total_amount ?? 0), 0);
    return { room, bookingCount: roomBookings.length, nights, revenue };
  }).sort((a, b) => b.revenue - a.revenue);

  // Employee allocation
  const employeeAllocation = employees.map(emp => {
    const empBookings = filtered.filter(b => b.assigned_by === emp);
    return {
      name: emp,
      bookings: empBookings.length,
      revenue: empBookings.reduce((sum, b) => sum + (b.total_amount ?? 0), 0),
    };
  }).sort((a, b) => b.bookings - a.bookings);

  function exportCSV() {
    const headers = ['Reference', 'Guest', 'Room', 'Check In', 'Check Out', 'Status', 'Payment', 'Assigned By', 'Amount'];
    const rows = filtered.map(b => [
      b.booking_reference,
      `${b.guest?.first_name} ${b.guest?.last_name}`,
      b.room?.room_number ?? '',
      b.check_in_date,
      b.check_out_date,
      b.status,
      b.payment_status,
      b.assigned_by ?? '',
      b.total_amount ?? 0,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${months[monthFilter]}-${yearFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-32 rounded-lg" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Monthly allocation reports with filtering</p>
        </div>
        <button onClick={exportCSV} disabled={filtered.length === 0} className="btn-secondary">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="label-field">Month</label>
            <select value={monthFilter} onChange={(e) => setMonthFilter(parseInt(e.target.value))} className="input-field">
              {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Year</label>
            <select value={yearFilter} onChange={(e) => setYearFilter(parseInt(e.target.value))} className="input-field">
              {[new Date().getFullYear(), new Date().getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Employee</label>
            <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="input-field">
              <option value="all">All Employees</option>
              {employees.map(emp => <option key={emp} value={emp}>{emp}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Room</label>
            <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className="input-field">
              <option value="all">All Rooms</option>
              {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Bookings', value: filtered.length, icon: Calendar, color: 'text-sky-600 bg-sky-50' },
          { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Collected', value: `₹${paidRevenue.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-violet-600 bg-violet-50' },
          { label: 'Total Nights', value: totalNights, icon: BedDouble, color: 'text-amber-600 bg-amber-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {pendingRevenue > 0 && (
        <div className="card p-4 flex items-center gap-3 bg-amber-50/50">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <IndianRupee className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">Pending Payments</p>
            <p className="text-xs text-amber-700">₹{pendingRevenue.toLocaleString('en-IN')} awaiting collection</p>
          </div>
        </div>
      )}

      {/* Room allocation table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">Room Allocation Report — {months[monthFilter]} {yearFilter}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Room</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Type</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase px-4 py-3">Bookings</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase px-4 py-3">Nights</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase px-4 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roomAllocation.filter(r => r.bookingCount > 0).map(({ room, bookingCount, nights, revenue }) => (
                <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">Room {room.room_number}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 capitalize">{room.room_type}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-center">{bookingCount}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-center">{nights}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right">₹{revenue.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {roomAllocation.filter(r => r.bookingCount > 0).length === 0 && (
            <div className="p-8 text-center">
              <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No bookings for this period with current filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Employee allocation */}
      {employeeAllocation.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">Employee Allocation</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Employee</th>
                  <th className="text-center text-xs font-semibold text-slate-500 uppercase px-4 py-3">Bookings Assigned</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase px-4 py-3">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employeeAllocation.map(emp => (
                  <tr key={emp.name} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 text-xs font-semibold">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 text-center">{emp.bookings}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right">₹{emp.revenue.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed bookings table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">Detailed Bookings — {months[monthFilter]} {yearFilter}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Reference</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Guest</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Room</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Dates</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Assigned By</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(booking => (
                <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-slate-700">{booking.booking_reference}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{booking.guest?.first_name} {booking.guest?.last_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{booking.room?.room_number}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {new Date(booking.check_in_date).toLocaleDateString()} - {new Date(booking.check_out_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{booking.assigned_by ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={booking.status} /></td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">₹{(booking.total_amount ?? 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No bookings match the current filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
