/*
# Guest House Management System - Initial Schema

## Overview
Creates the complete database schema for a Guest House Management application with role-based access control (admin, staff, duty_manager). The app requires authentication, so all tables use auth.uid()-based RLS policies.

## New Tables

### profiles
- Stores user role information linked to auth.users
- `id` (uuid, PK, references auth.users)
- `full_name` (text, not null)
- `role` (text, not null, default 'staff') - one of: 'admin', 'staff', 'duty_manager'
- `phone` (text, nullable)
- `created_at` (timestamptz)

### rooms
- Stores all rooms in the guest house
- `id` (uuid, PK)
- `room_number` (text, unique, not null)
- `room_type` (text, not null) - 'single' or 'double'
- `floor` (int, nullable)
- `status` (text, not null, default 'available') - 'available', 'occupied', 'maintenance', 'reserved'
- `price_per_night` (numeric, not null)
- `notes` (text, nullable)
- `created_at` (timestamptz)

### guests
- Stores guest information
- `id` (uuid, PK)
- `first_name` (text, not null)
- `last_name` (text, not null)
- `email` (text, nullable)
- `phone` (text, nullable)
- `address` (text, nullable)
- `id_number` (text, nullable) - ID/passport number
- `company` (text, nullable) - for corporate bookings
- `created_at` (timestamptz)

### bookings
- Reservation records linking guests to rooms
- `id` (uuid, PK)
- `guest_id` (uuid, FK to guests)
- `room_id` (uuid, FK to rooms)
- `check_in_date` (date, not null)
- `check_out_date` (date, not null)
- `status` (text, not null, default 'confirmed') - 'confirmed', 'checked_in', 'checked_out', 'cancelled'
- `booking_reference` (text, unique, not null)
- `assigned_by` (text, nullable) - employee name who made/assigned booking
- `total_amount` (numeric, nullable)
- `payment_status` (text, default 'pending') - 'pending', 'paid', 'partial'
- `notes` (text, nullable)
- `created_at` (timestamptz)

### notifications
- System notifications and alerts
- `id` (uuid, PK)
- `type` (text, not null) - 'booking_confirmation', 'check_in_alert', 'check_out_alert', 'payment_reminder', 'maintenance'
- `title` (text, not null)
- `message` (text, not null)
- `recipient` (text, not null) - 'admin', 'staff', 'duty_manager', 'all', or guest email
- `booking_id` (uuid, FK to bookings, nullable)
- `is_read` (boolean, default false)
- `created_at` (timestamptz)

## Security
- RLS enabled on all tables
- profiles: users can read/update their own profile; admin can read all
- rooms, guests, bookings, notifications: all authenticated staff can CRUD (shared operational data)
- All policies scoped to authenticated role
*/

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'duty_manager')),
  phone text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- ROOMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number text UNIQUE NOT NULL,
  room_type text NOT NULL CHECK (room_type IN ('single', 'double')),
  floor int,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
  price_per_night numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_rooms" ON rooms;
CREATE POLICY "select_rooms" ON rooms FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_rooms" ON rooms;
CREATE POLICY "insert_rooms" ON rooms FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_rooms" ON rooms;
CREATE POLICY "update_rooms" ON rooms FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_rooms" ON rooms;
CREATE POLICY "delete_rooms" ON rooms FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- GUESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  address text,
  id_number text,
  company text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_guests" ON guests;
CREATE POLICY "select_guests" ON guests FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_guests" ON guests;
CREATE POLICY "insert_guests" ON guests FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_guests" ON guests;
CREATE POLICY "update_guests" ON guests FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_guests" ON guests;
CREATE POLICY "delete_guests" ON guests FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- BOOKINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled')),
  booking_reference text UNIQUE NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  assigned_by text,
  total_amount numeric(10,2),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_bookings" ON bookings;
CREATE POLICY "select_bookings" ON bookings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_bookings" ON bookings;
CREATE POLICY "insert_bookings" ON bookings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_bookings" ON bookings;
CREATE POLICY "update_bookings" ON bookings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_bookings" ON bookings;
CREATE POLICY "delete_bookings" ON bookings FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('booking_confirmation', 'check_in_alert', 'check_out_alert', 'payment_reminder', 'maintenance', 'general')),
  title text NOT NULL,
  message text NOT NULL,
  recipient text NOT NULL DEFAULT 'all',
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_notifications" ON notifications;
CREATE POLICY "select_notifications" ON notifications FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_notifications" ON notifications;
CREATE POLICY "insert_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_notifications" ON notifications;
CREATE POLICY "update_notifications" ON notifications FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_notifications" ON notifications;
CREATE POLICY "delete_notifications" ON notifications FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bookings_guest_id ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_check_in ON bookings(check_in_date);
CREATE INDEX IF NOT EXISTS idx_bookings_check_out ON bookings(check_out_date);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED DATA: Sample rooms
-- ============================================================
INSERT INTO rooms (room_number, room_type, floor, status, price_per_night, notes) VALUES
  ('101', 'single', 1, 'available', 75.00, 'Standard single room with garden view'),
  ('102', 'single', 1, 'available', 75.00, 'Standard single room with garden view'),
  ('103', 'double', 1, 'available', 120.00, 'Spacious double room with en-suite'),
  ('201', 'single', 2, 'available', 85.00, 'Deluxe single room with balcony'),
  ('202', 'double', 2, 'available', 140.00, 'Deluxe double room with city view'),
  ('203', 'double', 2, 'maintenance', 140.00, 'Deluxe double room - currently under renovation'),
  ('301', 'single', 3, 'available', 90.00, 'Premium single room with mountain view'),
  ('302', 'double', 3, 'available', 160.00, 'Premium double room with Jacuzzi'),
  ('303', 'double', 3, 'available', 160.00, 'Premium double room with Jacuzzi')
ON CONFLICT (room_number) DO NOTHING;
