import { describe, it, expect } from 'vitest';
import { can, ALL_PERMISSIONS, ROLE_PERMISSIONS, PAGE_PERMISSION } from '@/lib/permissions';

describe('RBAC matrix', () => {
  it('admin holds every permission', () => {
    for (const p of ALL_PERMISSIONS) expect(can('admin', p)).toBe(true);
  });
  it('staff: front-desk work only', () => {
    for (const p of ['bookings.create', 'bookings.edit', 'bookings.checkin', 'bookings.cancel', 'guests.manage', 'rooms.markClean'] as const) expect(can('staff', p)).toBe(true);
    for (const p of ['rooms.manage', 'rooms.maintenance', 'bookings.delete', 'reports.view', 'reports.export'] as const) expect(can('staff', p)).toBe(false);
  });
  it('duty manager: rooms + reports + check-in/out, but cannot create bookings or edit guests', () => {
    for (const p of ['rooms.maintenance', 'rooms.markClean', 'bookings.checkin', 'reports.view', 'reports.export'] as const) expect(can('duty_manager', p)).toBe(true);
    for (const p of ['bookings.create', 'bookings.edit', 'bookings.delete', 'guests.manage', 'rooms.manage'] as const) expect(can('duty_manager', p)).toBe(false);
  });
  it('unknown / missing role has no permissions', () => {
    expect(can(null, 'rooms.view')).toBe(false);
    expect(can(undefined, 'rooms.view')).toBe(false);
    expect(can('guest' as any, 'rooms.view')).toBe(false);
  });
  it('only admin may delete bookings or manage rooms (least privilege)', () => {
    for (const role of ['staff', 'duty_manager'] as const) {
      expect(ROLE_PERMISSIONS[role]).not.toContain('bookings.delete');
      expect(ROLE_PERMISSIONS[role]).not.toContain('rooms.manage');
    }
  });
  it('every page maps to a real permission', () => {
    for (const perm of Object.values(PAGE_PERMISSION)) expect(ALL_PERMISSIONS).toContain(perm);
  });
});
