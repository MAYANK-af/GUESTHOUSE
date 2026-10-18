import { useEffect, useState, type FormEvent } from 'react';
import { supabase, type Guest, type Booking } from '@/lib/supabase';
import { Plus, Pencil, Trash2, Search, Loader2, Users, Mail, Phone, MapPin, Building, Calendar, History } from 'lucide-react';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/permissions';
import { ID_TYPES, maskId, normalizeId, validateId, type IdType } from '@/lib/identity';
import { formatINR } from '@/lib/booking';

export default function Guests() {
  const { profile } = useAuth();
  const canManage = can(profile?.role, 'guests.manage');
  const canDelete = can(profile?.role, 'bookings.delete'); // deleting a guest cascades to their bookings -> admin only
  const [idError, setIdError] = useState<string | null>(null);
  const [idType, setIdType] = useState<IdType>('aadhaar');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [historyModal, setHistoryModal] = useState<Guest | null>(null);
  const [guestBookings, setGuestBookings] = useState<Booking[]>([]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [company, setCompany] = useState('');

  useEffect(() => { loadGuests(); }, []);

  async function loadGuests() {
    setLoading(true);
    const { data } = await supabase.from('guests').select('*').order('created_at', { ascending: false });
    setGuests(data as Guest[] ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditingGuest(null);
    setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setAddress(''); setIdNumber(''); setCompany(''); setIdType('aadhaar'); setIdError(null);
    setModalOpen(true);
  }

  function openEdit(guest: Guest) {
    setEditingGuest(guest);
    setFirstName(guest.first_name); setLastName(guest.last_name); setEmail(guest.email ?? '');
    setPhone(guest.phone ?? ''); setAddress(guest.address ?? ''); setIdNumber(guest.id_number ?? ''); setCompany(guest.company ?? ''); setIdType((guest.id_type as IdType) ?? 'other'); setIdError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (idNumber.trim()) {
      const err = validateId(idType, idNumber);
      if (err) { setIdError(err); return; }
    }
    setIdError(null);
    setSaving(true);
    const payload = {
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      address: address || null,
      id_type: idNumber.trim() ? idType : null,
      id_number: idNumber.trim() ? normalizeId(idType, idNumber) : null,
      company: company || null,
    };

    if (editingGuest) {
      await supabase.from('guests').update(payload).eq('id', editingGuest.id);
    } else {
      await supabase.from('guests').insert(payload);
    }

    setSaving(false);
    setModalOpen(false);
    loadGuests();
  }

  async function handleDelete(guest: Guest) {
    if (!confirm(`Delete guest ${guest.first_name} ${guest.last_name}? This will also delete their bookings.`)) return;
    await supabase.from('guests').delete().eq('id', guest.id);
    loadGuests();
  }

  async function showHistory(guest: Guest) {
    const { data } = await supabase
      .from('bookings')
      .select('*, room:rooms(*)')
      .eq('guest_id', guest.id)
      .order('check_in_date', { ascending: false });
    setGuestBookings(data as Booking[] ?? []);
    setHistoryModal(guest);
  }

  const filtered = guests.filter(g => {
    const q = search.toLowerCase();
    return g.first_name.toLowerCase().includes(q) ||
      g.last_name.toLowerCase().includes(q) ||
      (g.email?.toLowerCase().includes(q) ?? false) ||
      (g.phone?.includes(q) ?? false) ||
      (g.company?.toLowerCase().includes(q) ?? false);
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Guest Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage guest profiles and view stay history</p>
        </div>
        {canManage && (
          <button onClick={openAdd} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Guest
          </button>
        )}
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(guest => (
          <div key={guest.id} className="card p-5 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-bold text-lg">
                  {guest.first_name.charAt(0)}{guest.last_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{guest.first_name} {guest.last_name}</h3>
                  {guest.company && <p className="text-xs text-slate-500">{guest.company}</p>}
                </div>
              </div>
              {canManage && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(guest)} aria-label={`Edit ${guest.first_name}`} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-sky-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {canDelete && (
                    <button onClick={() => handleDelete(guest)} aria-label={`Delete ${guest.first_name}`} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2 text-sm">
              {guest.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{guest.email}</span>
                </div>
              )}
              {guest.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>{guest.phone}</span>
                </div>
              )}
              {guest.address && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{guest.address}</span>
                </div>
              )}
              {guest.id_number && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Building className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>{ID_TYPES.find(t => t.value === guest.id_type)?.label ?? 'ID'}: {maskId(guest.id_type, guest.id_number)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 mt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">Added {new Date(guest.created_at).toLocaleDateString()}</span>
              <button onClick={() => showHistory(guest)} className="btn-ghost text-xs px-2.5 py-1.5">
                <History className="w-3.5 h-3.5" />
                Stay History
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No guests found. Add your first guest!</p>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingGuest ? 'Edit Guest' : 'Add New Guest'} maxWidth="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">First Name</label>
              <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input-field" placeholder="Aarav" />
            </div>
            <div>
              <label className="label-field">Last Name</label>
              <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="input-field" placeholder="Sharma" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="aarav.sharma@tcs.com" />
            </div>
            <div>
              <label className="label-field">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" placeholder="+91 98201 23456" />
            </div>
          </div>
          <div>
            <label className="label-field">Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="input-field" placeholder="Flat 402, Powai, Mumbai" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Identity Proof</label>
              <div className="flex gap-2">
                <select aria-label="ID type" value={idType} onChange={(e) => { setIdType(e.target.value as IdType); setIdError(null); }} className="input-field w-40">
                  {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input type="text" aria-label="ID number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="input-field" placeholder={ID_TYPES.find(t => t.value === idType)?.hint} />
              </div>
              {idError && <p role="alert" className="text-xs text-red-600 mt-1">{idError}</p>}
            </div>
            <div>
              <label className="label-field">Company</label>
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="input-field" placeholder="Tata Consultancy Services" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingGuest ? 'Save Changes' : 'Add Guest'}
            </button>
          </div>
        </form>
      </Modal>

      {/* History modal */}
      <Modal open={!!historyModal} onClose={() => setHistoryModal(null)} title={`Stay History — ${historyModal?.first_name} ${historyModal?.last_name}`} maxWidth="max-w-2xl">
        {guestBookings.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No previous stays recorded</p>
          </div>
        ) : (
          <div className="space-y-3">
            {guestBookings.map(booking => (
              <div key={booking.id} className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-sky-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">Room {booking.room?.room_number}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(booking.check_in_date).toLocaleDateString()} → {new Date(booking.check_out_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={booking.status} />
                  {booking.total_amount && <p className="text-xs text-slate-500 mt-1">{formatINR(booking.total_amount)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
