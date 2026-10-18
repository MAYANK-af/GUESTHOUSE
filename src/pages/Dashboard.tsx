import { useEffect, useState } from 'react';
import { supabase, type Room, type Booking, type Guest } from '@/lib/supabase';
import { Hotel, CalendarCheck, Users, TrendingUp, ArrowUpRight, ArrowDownRight, IndianRupee, BedDouble, Wrench, Clock, Sparkles, Bot } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { todayISO } from '@/lib/booking';

export default function Dashboard() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayCheckIns, setTodayCheckIns] = useState<Booking[]>([]);
  const [todayCheckOuts, setTodayCheckOuts] = useState<Booking[]>([]);

  useEffect(() => {
    async function loadData() {
      const [roomsRes, bookingsRes, guestsRes] = await Promise.all([
        supabase.from('rooms').select('*'),
        supabase.from('bookings').select('*, guest:guests(*), room:rooms(*)').order('check_in_date', { ascending: false }),
        supabase.from('guests').select('*'),
      ]);

      setRooms(roomsRes.data as Room[] ?? []);
      setBookings(bookingsRes.data as Booking[] ?? []);
      setGuests(guestsRes.data as Guest[] ?? []);
      setLoading(false);

      const today = todayISO(); // local date (toISOString() is UTC and is wrong for IST mornings)
      setTodayCheckIns((bookingsRes.data as Booking[] ?? []).filter(b => b.check_in_date === today && b.status === 'confirmed'));
      setTodayCheckOuts((bookingsRes.data as Booking[] ?? []).filter(b => b.check_out_date === today && b.status === 'checked_in'));
    }
    loadData();
  }, []);

  const availableRooms = rooms.filter(r => r.status === 'available').length;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const maintenanceRooms = rooms.filter(r => r.status === 'maintenance').length;
  const occupancyRate = rooms.length > 0 ? Math.round((occupiedRooms / rooms.length) * 100) : 0;
  const activeBookings = bookings.filter(b => b.status === 'checked_in' || b.status === 'confirmed').length;
  const monthlyRevenue = bookings
    .filter(b => {
      const d = new Date(b.check_in_date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && b.payment_status === 'paid';
    })
    .reduce((sum, b) => sum + (b.total_amount ?? 0), 0);

  const stats = [
    { label: 'Total Rooms', value: rooms.length, icon: Hotel, color: 'bg-sky-500', bg: 'bg-sky-50', change: `${availableRooms} available` },
    { label: 'Occupancy Rate', value: `${occupancyRate}%`, icon: TrendingUp, color: 'bg-emerald-500', bg: 'bg-emerald-50', change: `${occupiedRooms} occupied` },
    { label: 'Active Bookings', value: activeBookings, icon: CalendarCheck, color: 'bg-violet-500', bg: 'bg-violet-50', change: `${bookings.length} total` },
    { label: 'Total Guests', value: guests.length, icon: Users, color: 'bg-amber-500', bg: 'bg-amber-50', change: 'Registered' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of your guest house operations</p>
      </div>

      {/* AI Features Spotlight Banner */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-sky-500/20 text-sky-300 text-xs px-2.5 py-0.5 rounded-full border border-sky-400/30 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                AI Suite Active
              </span>
              <span className="text-xs text-sky-200">Google Gemini Flash &amp; Vision</span>
            </div>
            <h2 className="text-lg font-bold text-white">GuestHouse Pro AI Tools Enabled</h2>
            <p className="text-xs text-sky-200/80 max-w-2xl leading-relaxed">
              • <strong>Front-Desk AI Copilot</strong> (Ctrl+K): Conversational bookings, check-out, GST inquiries, and room status updates.<br/>
              • <strong>Smart ID Document Scanner</strong>: Instant Aadhaar/Passport vision OCR autofill on the Guests page.<br/>
              • <strong>Smart Room Recommender</strong>: Ranks free rooms by corporate tariff and guest history on Bookings.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Bot className="w-4 h-4" />
              Launch AI Copilot (Ctrl+K)
            </button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg, change }) => (
          <div key={label} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">{change}</p>
          </div>
        ))}
      </div>

      {/* Revenue + Room status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-6 lg:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Monthly Revenue</p>
              <p className="text-2xl font-bold text-slate-900">₹{monthlyRevenue.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="space-y-3 mt-6">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Available</span>
                <span className="font-semibold text-slate-900">{availableRooms}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${rooms.length ? (availableRooms / rooms.length) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Occupied</span>
                <span className="font-semibold text-slate-900">{occupiedRooms}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${rooms.length ? (occupiedRooms / rooms.length) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Maintenance</span>
                <span className="font-semibold text-slate-900">{maintenanceRooms}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${rooms.length ? (maintenanceRooms / rooms.length) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Today's check-ins/outs */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Today's Activity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-sky-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ArrowDownRight className="w-5 h-5 text-sky-600" />
                <span className="font-semibold text-sky-900">Check-ins</span>
                <span className="ml-auto text-2xl font-bold text-sky-700">{todayCheckIns.length}</span>
              </div>
              <div className="space-y-2">
                {todayCheckIns.length === 0 ? (
                  <p className="text-sm text-sky-600 italic">No check-ins today</p>
                ) : (
                  todayCheckIns.slice(0, 3).map(b => (
                    <div key={b.id} className="text-sm text-sky-800 bg-white/60 rounded-lg px-3 py-2">
                      <span className="font-medium">{b.guest?.first_name} {b.guest?.last_name}</span>
                      <span className="text-sky-600"> — Room {b.room?.room_number}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ArrowUpRight className="w-5 h-5 text-amber-600" />
                <span className="font-semibold text-amber-900">Check-outs</span>
                <span className="ml-auto text-2xl font-bold text-amber-700">{todayCheckOuts.length}</span>
              </div>
              <div className="space-y-2">
                {todayCheckOuts.length === 0 ? (
                  <p className="text-sm text-amber-600 italic">No check-outs today</p>
                ) : (
                  todayCheckOuts.slice(0, 3).map(b => (
                    <div key={b.id} className="text-sm text-amber-800 bg-white/60 rounded-lg px-3 py-2">
                      <span className="font-medium">{b.guest?.first_name} {b.guest?.last_name}</span>
                      <span className="text-amber-600"> — Room {b.room?.room_number}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Room overview + recent bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Room Status Overview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {rooms.slice(0, 9).map(room => (
              <div key={room.id} className="rounded-xl border border-slate-200 p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900">{room.room_number}</span>
                  {room.room_type !== 'standard' ? <BedDouble className="w-4 h-4 text-slate-400" /> : <Hotel className="w-4 h-4 text-slate-400" />}
                </div>
                <StatusBadge status={room.status} />
                <p className="text-xs text-slate-400 mt-2">₹{room.price_per_night.toLocaleString('en-IN')}/night</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Bookings</h3>
          <div className="space-y-3">
            {bookings.slice(0, 5).map(booking => (
              <div key={booking.id} className="flex items-center gap-3 rounded-xl hover:bg-slate-50 px-3 py-2.5 transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-semibold text-sm">
                  {booking.guest?.first_name?.charAt(0)}{booking.guest?.last_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {booking.guest?.first_name} {booking.guest?.last_name}
                  </p>
                  <p className="text-xs text-slate-500">Room {booking.room?.room_number} • {new Date(booking.check_in_date).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={booking.status} />
              </div>
            ))}
            {bookings.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No bookings yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: BedDouble, label: 'Deluxe & Suites', value: rooms.filter(r => r.room_type !== 'standard').length, color: 'text-violet-600 bg-violet-50' },
          { icon: Sparkles, label: 'Awaiting Cleaning', value: rooms.filter(r => r.status === 'cleaning').length, color: 'text-sky-600 bg-sky-50' },
          { icon: Wrench, label: 'Under Maintenance', value: maintenanceRooms, color: 'text-amber-600 bg-amber-50' },
          { icon: Clock, label: 'Pending Payments', value: bookings.filter(b => b.payment_status === 'pending').length, color: 'text-red-600 bg-red-50' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
