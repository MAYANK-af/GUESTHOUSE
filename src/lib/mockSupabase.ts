// Mock Supabase implementation for offline / local-demo operation
// Stores all data in localStorage so that CRUD changes persist across reloads.

const STORAGE_KEY_PREFIX = 'gh_pro_inr_';

function getStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Default Seed Data with Indian Names and INR Pricing
const DEFAULT_PROFILES = [
  { id: 'usr-admin-1', full_name: 'Rajesh Sharma', role: 'admin', phone: '+91 98201 11000', created_at: new Date().toISOString() },
  { id: 'usr-staff-1', full_name: 'Sunita Mehra', role: 'staff', phone: '+91 98201 11001', created_at: new Date().toISOString() },
  { id: 'usr-manager-1', full_name: 'Vikramaditya Rao', role: 'duty_manager', phone: '+91 98201 11002', created_at: new Date().toISOString() },
];

const DEFAULT_ROOMS = [
  { id: 'rm-101', room_number: '101', room_type: 'single', floor: 1, status: 'occupied', price_per_night: 2500, notes: 'Ground floor, garden view', created_at: new Date().toISOString() },
  { id: 'rm-102', room_number: '102', room_type: 'single', floor: 1, status: 'available', price_per_night: 2500, notes: null, created_at: new Date().toISOString() },
  { id: 'rm-103', room_number: '103', room_type: 'single', floor: 1, status: 'available', price_per_night: 2800, notes: 'Corner room with study desk', created_at: new Date().toISOString() },
  { id: 'rm-201', room_number: '201', room_type: 'double', floor: 2, status: 'reserved', price_per_night: 4500, notes: 'King size bed, balcony', created_at: new Date().toISOString() },
  { id: 'rm-202', room_number: '202', room_type: 'double', floor: 2, status: 'available', price_per_night: 4500, notes: 'King size bed', created_at: new Date().toISOString() },
  { id: 'rm-203', room_number: '203', room_type: 'double', floor: 2, status: 'available', price_per_night: 5000, notes: 'Deluxe double with patio', created_at: new Date().toISOString() },
  { id: 'rm-301', room_number: '301', room_type: 'double', floor: 3, status: 'occupied', price_per_night: 6500, notes: 'Executive Suite, panoramic view', created_at: new Date().toISOString() },
  { id: 'rm-302', room_number: '302', room_type: 'double', floor: 3, status: 'maintenance', price_per_night: 6500, notes: 'AC repair in progress by duty manager', created_at: new Date().toISOString() },
];

const DEFAULT_GUESTS = [
  { id: 'gst-1', first_name: 'Aarav', last_name: 'Sharma', email: 'aarav.sharma@tcs.com', phone: '+91 98201 23456', address: 'Flat 402, Powai, Mumbai', id_number: 'IND-A482910', company: 'Tata Consultancy Services', created_at: new Date().toISOString() },
  { id: 'gst-2', first_name: 'Priya', last_name: 'Patel', email: 'priya.patel@infosys.com', phone: '+91 97123 45678', address: '12th Cross, Indiranagar, Bengaluru', id_number: 'IND-B992341', company: 'Infosys Ltd', created_at: new Date().toISOString() },
  { id: 'gst-3', first_name: 'Rohan', last_name: 'Verma', email: 'rohan.verma@wipro.com', phone: '+91 99887 65432', address: 'Sector 45, Gurugram', id_number: 'IND-C771290', company: 'Wipro Technologies', created_at: new Date().toISOString() },
  { id: 'gst-4', first_name: 'Ananya', last_name: 'Iyer', email: 'ananya.iyer@hcl.com', phone: '+91 98450 11223', address: 'Anna Salai, T. Nagar, Chennai', id_number: 'IND-D123984', company: 'HCL Technologies', created_at: new Date().toISOString() },
  { id: 'gst-5', first_name: 'Vikram', last_name: 'Singh', email: 'vikram.singh@reliance.com', phone: '+91 98112 34567', address: 'BKC, Bandra, Mumbai', id_number: 'IND-E556789', company: 'Reliance Industries', created_at: new Date().toISOString() },
];

function getInitialBookings() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const pastDate = new Date(today);
  pastDate.setDate(today.getDate() - 3);
  const pastStr = pastDate.toISOString().split('T')[0];

  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 4);
  const futureStr = futureDate.toISOString().split('T')[0];

  return [
    {
      id: 'bk-1',
      guest_id: 'gst-1',
      room_id: 'rm-301',
      check_in_date: pastStr,
      check_out_date: futureStr,
      status: 'checked_in',
      booking_reference: 'GH-IN-1001',
      assigned_by: 'Sunita Mehra',
      total_amount: 45500,
      payment_status: 'paid',
      notes: 'VIP Executive stay - TCS corporate tariff',
      created_at: new Date().toISOString(),
    },
    {
      id: 'bk-2',
      guest_id: 'gst-2',
      room_id: 'rm-201',
      check_in_date: todayStr,
      check_out_date: futureStr,
      status: 'confirmed',
      booking_reference: 'GH-IN-1002',
      assigned_by: 'Sunita Mehra',
      total_amount: 18000,
      payment_status: 'pending',
      notes: 'Requested late check-in at 8 PM',
      created_at: new Date().toISOString(),
    },
    {
      id: 'bk-3',
      guest_id: 'gst-3',
      room_id: 'rm-101',
      check_in_date: pastStr,
      check_out_date: todayStr,
      status: 'checked_in',
      booking_reference: 'GH-IN-1003',
      assigned_by: 'Vikramaditya Rao',
      total_amount: 7500,
      payment_status: 'paid',
      notes: 'Single room allocation, breakfast included',
      created_at: new Date().toISOString(),
    },
  ];
}

const DEFAULT_NOTIFICATIONS = [
  { id: 'notif-1', type: 'check_in_alert', title: 'Guest Arrival', message: 'Aarav Sharma has checked into Room 301.', recipient: 'staff', booking_id: 'bk-1', is_read: false, created_at: new Date().toISOString() },
  { id: 'notif-2', type: 'maintenance', title: 'Maintenance Logged', message: 'Room 302 placed out of order for AC repair by Vikramaditya Rao.', recipient: 'duty_manager', booking_id: null, is_read: false, created_at: new Date().toISOString() },
  { id: 'notif-3', type: 'booking_confirmation', title: 'New Reservation', message: 'Booking confirmed for Priya Patel (Room 201).', recipient: 'admin', booking_id: 'bk-2', is_read: true, created_at: new Date().toISOString() },
  { id: 'notif-4', type: 'payment_reminder', title: 'Pending Payment Alert', message: 'Payment of ₹18,000 pending for Priya Patel (Room 201).', recipient: 'staff', booking_id: 'bk-2', is_read: false, created_at: new Date().toISOString() },
  { id: 'notif-5', type: 'check_in_alert', title: 'Guest Arrival', message: 'Rohan Verma has checked into Room 101.', recipient: 'staff', booking_id: 'bk-3', is_read: true, created_at: new Date().toISOString() },
];

// Initialize storage if empty
export function initMockStorage() {
  if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'profiles')) setStorage('profiles', DEFAULT_PROFILES);
  if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'rooms')) setStorage('rooms', DEFAULT_ROOMS);
  if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'guests')) setStorage('guests', DEFAULT_GUESTS);
  if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'bookings')) setStorage('bookings', getInitialBookings());
  if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'notifications')) setStorage('notifications', DEFAULT_NOTIFICATIONS);
}

// Auth State Subscriptions
type AuthListener = (event: string, session: any) => void;
const authListeners = new Set<AuthListener>();

function notifyAuthChange(event: string, session: any) {
  authListeners.forEach((fn) => fn(event, session));
}

export function createMockClient() {
  initMockStorage();

  const auth = {
    async getSession() {
      const session = getStorage('current_session', null);
      return { data: { session }, error: null };
    },

    onAuthStateChange(callback: AuthListener) {
      authListeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => authListeners.delete(callback),
          },
        },
      };
    },

    async signInWithPassword({ email, password }: { email: string; password?: string }) {
      const emailLower = (email || '').toLowerCase().trim();
      let role: 'admin' | 'staff' | 'duty_manager' = 'staff';
      let fullName = 'Sunita Mehra';

      if (emailLower.includes('admin')) {
        role = 'admin';
        fullName = 'Rajesh Sharma';
      } else if (emailLower.includes('manager')) {
        role = 'duty_manager';
        fullName = 'Vikramaditya Rao';
      } else if (emailLower.includes('staff')) {
        role = 'staff';
        fullName = 'Sunita Mehra';
      } else {
        fullName = email.split('@')[0] || 'User';
      }

      const userId = 'usr-' + btoa(emailLower).replace(/=/g, '').slice(0, 8);
      const user = { id: userId, email: emailLower, user_metadata: { full_name: fullName, role } };
      const session = { access_token: 'mock-token-' + Date.now(), user };

      setStorage('current_session', session);

      // Ensure profile exists
      const profiles = getStorage<any[]>('profiles', DEFAULT_PROFILES);
      if (!profiles.some((p) => p.id === userId)) {
        profiles.push({ id: userId, full_name: fullName, role, phone: '+91 98201 11000', created_at: new Date().toISOString() });
        setStorage('profiles', profiles);
      }

      notifyAuthChange('SIGNED_IN', session);
      return { data: { user, session }, error: null };
    },

    async signUp({ email, password, options }: any) {
      const fullName = options?.data?.full_name || email.split('@')[0] || 'New User';
      const role = options?.data?.role || 'staff';
      const userId = uuid();
      const user = { id: userId, email, user_metadata: { full_name: fullName, role } };
      const session = { access_token: 'mock-token-' + Date.now(), user };

      setStorage('current_session', session);

      const profiles = getStorage<any[]>('profiles', DEFAULT_PROFILES);
      profiles.push({ id: userId, full_name: fullName, role, phone: null, created_at: new Date().toISOString() });
      setStorage('profiles', profiles);

      notifyAuthChange('SIGNED_IN', session);
      return { data: { user, session }, error: null };
    },

    async signOut() {
      setStorage('current_session', null);
      notifyAuthChange('SIGNED_OUT', null);
      return { error: null };
    },
  };

  // Realtime subscription listeners
  type RealtimeListener = { table: string; callback: () => void };
  const realtimeListeners = new Set<RealtimeListener>();

  function broadcastTableChange(table: string) {
    realtimeListeners.forEach((l) => {
      if (l.table === '*' || l.table === table) {
        try {
          l.callback();
        } catch (e) {
          console.error('Error in realtime listener:', e);
        }
      }
    });
  }

  type FilterOp =
    | { type: 'eq'; field: string; val: any }
    | { type: 'neq'; field: string; val: any }
    | { type: 'in'; field: string; vals: any[] };

  class MockQueryBuilder {
    private table: string;
    private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
    private actionPayload: any = null;
    private filters: FilterOp[] = [];
    private orderField: string | null = null;
    private orderAsc: boolean = true;
    private limitCount: number | null = null;
    private isSingle: boolean = false;
    private isCountHead: boolean = false;

    constructor(table: string) {
      this.table = table;
    }

    select(columns = '*', options?: { count?: string; head?: boolean }) {
      if (this.action !== 'insert') {
        this.action = 'select';
      }
      if (options?.head) this.isCountHead = true;
      return this;
    }

    insert(items: any | any[]) {
      this.action = 'insert';
      this.actionPayload = items;
      return this;
    }

    upsert(items: any | any[]) {
      this.action = 'upsert';
      this.actionPayload = items;
      return this;
    }

    update(updates: any) {
      this.action = 'update';
      this.actionPayload = updates;
      return this;
    }

    delete() {
      this.action = 'delete';
      return this;
    }

    eq(column: string, value: any) {
      this.filters.push({ type: 'eq', field: column, val: value });
      return this;
    }

    neq(column: string, value: any) {
      this.filters.push({ type: 'neq', field: column, val: value });
      return this;
    }

    in(column: string, values: any[]) {
      this.filters.push({ type: 'in', field: column, vals: values });
      return this;
    }

    order(column: string, options?: { ascending?: boolean }) {
      this.orderField = column;
      this.orderAsc = options?.ascending ?? true;
      return this;
    }

    limit(n: number) {
      this.limitCount = n;
      return this;
    }

    single() {
      this.isSingle = true;
      return this;
    }

    maybeSingle() {
      this.isSingle = true;
      return this;
    }

    private matchesFilters(row: any): boolean {
      for (const f of this.filters) {
        if (f.type === 'eq' && row[f.field] !== f.val) return false;
        if (f.type === 'neq' && row[f.field] === f.val) return false;
        if (f.type === 'in' && !f.vals.includes(row[f.field])) return false;
      }
      return true;
    }

    async execute(): Promise<{ data: any; error: null; count?: number }> {
      let rows = getStorage<any[]>(this.table, []);

      if (this.action === 'insert') {
        const arr = Array.isArray(this.actionPayload) ? this.actionPayload : [this.actionPayload];
        const inserted = arr.map((item) => {
          const id = item.id || uuid();
          const ref = item.booking_reference || (this.table === 'bookings' ? `GH-IN-${Math.floor(1000 + Math.random() * 9000)}` : undefined);
          const row: any = {
            id,
            created_at: item.created_at || new Date().toISOString(),
            ...item,
          };
          if (ref) row.booking_reference = ref;
          return row;
        });

        rows.push(...inserted);
        setStorage(this.table, rows);
        broadcastTableChange(this.table);

        const resData = this.isSingle ? (inserted[0] ?? null) : (Array.isArray(this.actionPayload) ? inserted : inserted[0]);
        return { data: resData, error: null };
      }

      if (this.action === 'upsert') {
        const arr = Array.isArray(this.actionPayload) ? this.actionPayload : [this.actionPayload];
        for (const item of arr) {
          const idx = rows.findIndex((r) => r.id === item.id);
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...item };
          } else {
            rows.push({ id: item.id || uuid(), created_at: new Date().toISOString(), ...item });
          }
        }
        setStorage(this.table, rows);
        broadcastTableChange(this.table);
        return { data: this.actionPayload, error: null };
      }

      if (this.action === 'update') {
        let updatedCount = 0;
        const updatedRows: any[] = [];
        for (let i = 0; i < rows.length; i++) {
          if (this.matchesFilters(rows[i])) {
            rows[i] = { ...rows[i], ...this.actionPayload };
            updatedRows.push(rows[i]);
            updatedCount++;
          }
        }
        setStorage(this.table, rows);
        broadcastTableChange(this.table);
        const resData = this.isSingle ? (updatedRows[0] ?? null) : updatedRows;
        return { data: resData, error: null, count: updatedCount };
      }

      if (this.action === 'delete') {
        const remaining: any[] = [];
        const deleted: any[] = [];
        for (const r of rows) {
          if (this.matchesFilters(r)) {
            deleted.push(r);
          } else {
            remaining.push(r);
          }
        }
        setStorage(this.table, remaining);

        // Cascading deletes
        if (this.table === 'rooms') {
          const deletedIds = new Set(deleted.map((d) => d.id));
          const allBookings = getStorage<any[]>('bookings', []);
          setStorage('bookings', allBookings.filter((b) => !deletedIds.has(b.room_id)));
        } else if (this.table === 'guests') {
          const deletedIds = new Set(deleted.map((d) => d.id));
          const allBookings = getStorage<any[]>('bookings', []);
          setStorage('bookings', allBookings.filter((b) => !deletedIds.has(b.guest_id)));
        }

        broadcastTableChange(this.table);
        return { data: this.isSingle ? (deleted[0] ?? null) : deleted, error: null, count: deleted.length };
      }

      // Default: 'select'
      let filtered = rows.filter((r) => this.matchesFilters(r));

      if (this.orderField) {
        filtered.sort((a, b) => {
          const va = a[this.orderField!];
          const vb = b[this.orderField!];
          if (va < vb) return this.orderAsc ? -1 : 1;
          if (va > vb) return this.orderAsc ? 1 : -1;
          return 0;
        });
      }

      // Join related models if bookings
      if (this.table === 'bookings') {
        const guests = getStorage<any[]>('guests', []);
        const rooms = getStorage<any[]>('rooms', []);
        filtered = filtered.map((b) => ({
          ...b,
          guest: guests.find((g) => g.id === b.guest_id),
          room: rooms.find((r) => r.id === b.room_id),
        }));
      }

      const totalCount = filtered.length;

      if (this.limitCount !== null) {
        filtered = filtered.slice(0, this.limitCount);
      }

      if (this.isCountHead) {
        return { data: null, count: totalCount, error: null };
      }

      const resData = this.isSingle ? (filtered[0] ?? null) : filtered;
      return { data: resData, count: totalCount, error: null };
    }

    then(onFulfilled?: (value: any) => any, onRejected?: (reason: any) => any) {
      return this.execute().then(onFulfilled, onRejected);
    }
  }

  function from(table: string) {
    return new MockQueryBuilder(table);
  }

  return {
    auth,
    from,
    channel: (name: string) => {
      let activeListener: RealtimeListener | null = null;
      return {
        on: (event: string, filter: { event?: string; schema?: string; table?: string }, callback: () => void) => {
          activeListener = { table: filter.table || '*', callback };
          realtimeListeners.add(activeListener);
          return {
            subscribe: () => ({}),
          };
        },
      };
    },
    removeChannel: (channel: any) => {
      // Clean up if needed
    },
  };
}
