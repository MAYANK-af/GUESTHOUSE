# Changes in v2

## New logic modules (`src/lib`)
- `booking.ts` - nights, half-open overlap, conflict search, GST slab (5% ≤ ₹7,500 / 18% above), invoice, INR format, local `todayISO()`.
- `bookingService.ts` - the only place that writes rooms/bookings: createBooking, updateBooking, changeBookingStatus, setRoomStatus.
- `roomFsm.ts` - 5-state room FSM + 4-state booking FSM.
- `permissions.ts` - role/permission matrix, page permissions.
- `identity.ts` - Aadhaar (Verhoeff), passport, DL, voter ID validation, masking.

## Changed
- Room types: standard / deluxe / executive / presidential. Room states add `cleaning`.
- Bookings store `subtotal`, `gst_rate`, `gst_amount`; `total_amount` is the grand total. Total can no longer be typed.
- Check-out sends the room to `cleaning`; *Mark clean* releases it.
- Guests: `id_type` + validated, masked `id_number`.
- Navigation, buttons and routes are gated by role; demo login buttons and role picker only in offline mode.
- Reports: cancelled bookings excluded; GST columns; safe CSV (quotes + formula injection).
- Dashboard "today" uses the local date (was UTC, wrong in India before 05:30).
- Offline storage keys are versioned (`gh_pro_v2_*`) so old browser data never mixes with the new schema.

## Database (`supabase/migrations/20261012090000_v2_rbac_gst_fsm.sql`)
- Exclusion constraint against overlapping stays; CHECKs for dates, room type/status, Aadhaar format.
- Role-aware RLS replacing `USING (true)`; sign-up trigger always creates `staff`; users cannot change their own role.

## Tooling
- Vitest + Testing Library + jsdom + PGlite; 91 tests; `npm test`.
- CI runs lint, typecheck and tests before building.
