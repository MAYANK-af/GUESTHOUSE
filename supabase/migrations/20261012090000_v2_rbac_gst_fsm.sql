/*
# GuestHouse Pro - v2 hardening migration

1. Room categories (standard / deluxe / executive / presidential) and the 5-state room lifecycle
   (available, reserved, occupied, cleaning, maintenance).
2. GST columns on bookings (subtotal, gst_rate, gst_amount; total_amount is the grand total).
3. Identity proof type on guests (aadhaar / passport / driving_license / voter_id / other).
4. Database-level double-booking guard: an EXCLUSION constraint on (room, stay interval).
5. Real role-based security: policies depend on profiles.role instead of "any signed-in user".
6. Privilege-escalation fix: users can no longer choose their own role at sign-up or update it later.
*/

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------- rooms
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_room_type_check;
UPDATE rooms SET room_type = CASE
  WHEN room_type = 'single' THEN 'standard'
  WHEN room_type = 'double' AND price_per_night >= 6000 THEN 'executive'
  WHEN room_type = 'double' THEN 'deluxe'
  ELSE room_type END
WHERE room_type IN ('single', 'double');
ALTER TABLE rooms ADD CONSTRAINT rooms_room_type_check
  CHECK (room_type IN ('standard', 'deluxe', 'executive', 'presidential'));

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('available', 'reserved', 'occupied', 'cleaning', 'maintenance'));

-- ---------------------------------------------------------------- guests
ALTER TABLE guests ADD COLUMN IF NOT EXISTS id_type text;
UPDATE guests SET id_type = 'other' WHERE id_type IS NULL AND id_number IS NOT NULL;
ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_id_type_check;
ALTER TABLE guests ADD CONSTRAINT guests_id_type_check
  CHECK (id_type IS NULL OR id_type IN ('aadhaar', 'passport', 'driving_license', 'voter_id', 'other'));
ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_aadhaar_format_check;
ALTER TABLE guests ADD CONSTRAINT guests_aadhaar_format_check
  CHECK (id_type IS DISTINCT FROM 'aadhaar' OR id_number ~ '^[2-9][0-9]{11}$');

-- ---------------------------------------------------------------- bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subtotal numeric(12,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gst_rate numeric(5,4);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gst_amount numeric(12,2);
ALTER TABLE bookings ALTER COLUMN total_amount TYPE numeric(12,2);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_dates_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_dates_check CHECK (check_out_date > check_in_date);

-- Same-day turnover is allowed because the interval is half-open: [check_in, check_out)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (room_id WITH =, daterange(check_in_date, check_out_date, '[)') WITH &&)
  WHERE (status <> 'cancelled');

-- ---------------------------------------------------------------- RBAC helpers
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- New accounts are ALWAYS 'staff'. Whatever role the client sends in sign-up metadata is ignored.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'), 'staff');
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------- profiles
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.current_app_role() = 'admin');

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'staff');

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = public.current_app_role());   -- cannot change own role

DROP POLICY IF EXISTS "admin_update_profiles" ON profiles;
CREATE POLICY "admin_update_profiles" ON profiles FOR UPDATE TO authenticated
  USING (public.current_app_role() = 'admin') WITH CHECK (public.current_app_role() = 'admin');

-- ---------------------------------------------------------------- rooms
DROP POLICY IF EXISTS "insert_rooms" ON rooms;
CREATE POLICY "insert_rooms" ON rooms FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() = 'admin');

DROP POLICY IF EXISTS "update_rooms" ON rooms;
CREATE POLICY "update_rooms" ON rooms FOR UPDATE TO authenticated
  USING (public.current_app_role() IN ('admin', 'duty_manager', 'staff'))
  WITH CHECK (public.current_app_role() IN ('admin', 'duty_manager', 'staff'));
-- (staff may update rooms because check-in / check-out / mark-clean change the room status;
--  which fields and transitions are allowed is enforced by the app's room state machine.)

DROP POLICY IF EXISTS "delete_rooms" ON rooms;
CREATE POLICY "delete_rooms" ON rooms FOR DELETE TO authenticated
  USING (public.current_app_role() = 'admin');

-- ---------------------------------------------------------------- guests
DROP POLICY IF EXISTS "insert_guests" ON guests;
CREATE POLICY "insert_guests" ON guests FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "update_guests" ON guests;
CREATE POLICY "update_guests" ON guests FOR UPDATE TO authenticated
  USING (public.current_app_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_app_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "delete_guests" ON guests;
CREATE POLICY "delete_guests" ON guests FOR DELETE TO authenticated
  USING (public.current_app_role() = 'admin');

-- ---------------------------------------------------------------- bookings
DROP POLICY IF EXISTS "insert_bookings" ON bookings;
CREATE POLICY "insert_bookings" ON bookings FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "update_bookings" ON bookings;
CREATE POLICY "update_bookings" ON bookings FOR UPDATE TO authenticated
  USING (public.current_app_role() IN ('admin', 'staff', 'duty_manager'))
  WITH CHECK (public.current_app_role() IN ('admin', 'staff', 'duty_manager'));  -- duty manager: check-in / check-out

DROP POLICY IF EXISTS "delete_bookings" ON bookings;
CREATE POLICY "delete_bookings" ON bookings FOR DELETE TO authenticated
  USING (public.current_app_role() = 'admin');

-- ---------------------------------------------------------------- notifications
DROP POLICY IF EXISTS "delete_notifications" ON notifications;
CREATE POLICY "delete_notifications" ON notifications FOR DELETE TO authenticated
  USING (public.current_app_role() = 'admin');
