import { createClient } from '@supabase/supabase-js';
import { createMockClient } from './mockSupabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isRealSupabase = supabaseUrl && 
  supabaseUrl.startsWith('http') && 
  !supabaseUrl.includes('placeholder') && 
  supabaseAnonKey && 
  !supabaseAnonKey.includes('placeholder');

export const supabase: any = isRealSupabase
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : createMockClient();

export const isMockMode = !isRealSupabase;

export type { UserRole } from './permissions';
import type { UserRole } from './permissions';
import type { IdType } from './identity';
import type { RoomStatus } from './roomFsm';
export type { IdType, RoomStatus };

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  created_at: string;
}

export type RoomType = 'standard' | 'deluxe' | 'executive' | 'presidential';

export interface Room {
  id: string;
  room_number: string;
  room_type: RoomType;
  floor: number | null;
  status: RoomStatus;
  price_per_night: number;
  notes: string | null;
  created_at: string;
}

export interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  id_type: IdType | null;
  id_number: string | null;
  company: string | null;
  created_at: string;
}

export type BookingStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'partial';

export interface Booking {
  id: string;
  guest_id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  status: BookingStatus;
  booking_reference: string;
  assigned_by: string | null;
  subtotal: number | null;
  gst_rate: number | null;
  gst_amount: number | null;
  total_amount: number | null; // grand total incl. GST
  payment_status: PaymentStatus;
  notes: string | null;
  created_at: string;
  guest?: Guest;
  room?: Room;
}

export type NotificationType =
  | 'booking_confirmation'
  | 'check_in_alert'
  | 'check_out_alert'
  | 'payment_reminder'
  | 'maintenance'
  | 'general';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  recipient: string;
  booking_id: string | null;
  is_read: boolean;
  created_at: string;
}
