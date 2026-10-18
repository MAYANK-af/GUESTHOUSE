import { useEffect, useState, type FormEvent } from 'react';
import { supabase, type Room, type RoomType } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/permissions';
import { ROOM_TRANSITIONS, type RoomStatus } from '@/lib/roomFsm';
import { BookingError, setRoomStatus } from '@/lib/bookingService';
import { formatINR } from '@/lib/booking';
import { Plus, Pencil, Trash2, Hotel, BedDouble, Search, Loader2, IndianRupee, Building } from 'lucide-react';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';

// 'occupied' and 'reserved' are driven by bookings (check-in / new booking); staff only change these manually.
const MANUAL_TARGETS: RoomStatus[] = ['available', 'cleaning', 'maintenance'];
const ROOM_TYPES: RoomType[] = ['standard', 'deluxe', 'executive', 'presidential'];

export default function Rooms() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canManage = can(role, 'rooms.manage');
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [saving, setSaving] = useState(false);

  // form state
  const [roomNumber, setRoomNumber] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('standard');
  const [floor, setFloor] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => { loadRooms(); }, []);

  async function loadRooms() {
    setLoading(true);
    const { data } = await supabase.from('rooms').select('*').order('room_number');
    setRooms(data as Room[] ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditingRoom(null);
    setRoomNumber(''); setRoomType('standard'); setFloor(''); setPrice(''); setNotes('');
    setModalOpen(true);
  }

  function openEdit(room: Room) {
    setEditingRoom(room);
    setRoomNumber(room.room_number);
    setRoomType(room.room_type);
    setFloor(room.floor?.toString() ?? '');
    setPrice(room.price_per_night.toString());
    setNotes(room.notes ?? '');
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      room_number: roomNumber,
      room_type: roomType,
      floor: floor ? parseInt(floor) : null,
      price_per_night: parseFloat(price) || 0,
      notes: notes || null,
    };

    if (editingRoom) {
      await supabase.from('rooms').update(payload).eq('id', editingRoom.id);
    } else {
      await supabase.from('rooms').insert({ ...payload, status: 'available' });
    }

    setSaving(false);
    setModalOpen(false);
    loadRooms();
  }

  async function handleDelete(room: Room) {
    if (!confirm(`Delete room ${room.room_number}? This will also delete all bookings for this room.`)) return;
    await supabase.from('rooms').delete().eq('id', room.id);
    loadRooms();
  }

  /** Targets this user may pick for a room: FSM-legal AND within the role's permission. */
  function allowedTargets(room: Room): RoomStatus[] {
    return MANUAL_TARGETS.filter((t) => {
      if (!ROOM_TRANSITIONS[room.status].includes(t)) return false;
      if (can(role, 'rooms.maintenance')) return true;
      return can(role, 'rooms.markClean') && room.status === 'cleaning' && t === 'available';
    });
  }

  async function handleStatusChange(room: Room, newStatus: RoomStatus) {
    setError(null);
    try {
      await setRoomStatus(supabase, room.id, newStatus);
    } catch (err) {
      setError(err instanceof BookingError ? err.message : 'Could not change the room status.');
    }
    loadRooms();
  }

  const filtered = rooms.filter(r => {
    const matchesSearch = r.room_number.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchesType = filterType === 'all' || r.room_type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Room Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage rooms, types, and availability status</p>
        </div>
        {canManage && (
          <button onClick={openAdd} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Room
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 ring-1 ring-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search room number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field sm:w-44">
          <option value="all">All Statuses</option>
          <option value="available">Available</option>
          <option value="occupied">Occupied</option>
          <option value="reserved">Reserved</option>
          <option value="cleaning">Cleaning</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-field sm:w-40">
          <option value="all">All Types</option>
          {ROOM_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
      </div>

      {/* Room cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(room => (
          <div key={room.id} className="card p-5 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  room.room_type !== 'standard' ? 'bg-violet-100' : 'bg-sky-100'
                }`}>
                  {room.room_type !== 'standard' ? <BedDouble className="w-6 h-6 text-violet-600" /> : <Hotel className="w-6 h-6 text-sky-600" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Room {room.room_number}</h3>
                  <p className="text-xs text-slate-500 capitalize">{room.room_type}{room.room_type === 'standard' || room.room_type === 'deluxe' ? ' room' : ' suite'}{room.floor ? ` • Floor ${room.floor}` : ''}</p>
                </div>
              </div>
              {canManage && (<div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button onClick={() => openEdit(room)} aria-label={`Edit room ${room.room_number}`} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-sky-600">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(room)} aria-label={`Delete room ${room.room_number}`} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>)}
            </div>

            <div className="mb-3">
              <StatusBadge status={room.status} />
            </div>

            {room.notes && <p className="text-sm text-slate-500 mb-3 line-clamp-2">{room.notes}</p>}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-700">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold">{formatINR(room.price_per_night).slice(1)}</span>
                <span className="text-xs text-slate-400">/night</span>
              </div>
              {allowedTargets(room).length > 0 && (
                <select
                  aria-label={`Change status of room ${room.room_number}`}
                  value={room.status}
                  onChange={(e) => handleStatusChange(room, e.target.value as RoomStatus)}
                  className="text-xs font-medium rounded-lg border-0 bg-slate-50 px-2.5 py-1.5 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value={room.status}>{room.status}</option>
                  {allowedTargets(room).map(t => (
                    <option key={t} value={t}>→ {t === 'available' && room.status === 'cleaning' ? 'mark clean (available)' : t}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card p-12 text-center">
          <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No rooms found matching your filters</p>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingRoom ? 'Edit Room' : 'Add New Room'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Room Number</label>
              <input type="text" required value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className="input-field" placeholder="101" />
            </div>
            <div>
              <label className="label-field">Floor</label>
              <input type="number" value={floor} onChange={(e) => setFloor(e.target.value)} className="input-field" placeholder="1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Room Type</label>
              <select value={roomType} onChange={(e) => setRoomType(e.target.value as RoomType)} className="input-field">
                {ROOM_TYPES.map(t => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">Price per Night (₹)</label>
              <input type="number" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} className="input-field" placeholder="2499" />
            </div>
          </div>
          <div>
            <label className="label-field">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field min-h-[80px] resize-y" placeholder="Optional notes about this room..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingRoom ? 'Save Changes' : 'Add Room'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
