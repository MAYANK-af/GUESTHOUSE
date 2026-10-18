// Role-based access control matrix (mirrored by the Row-Level Security policies in supabase/migrations).
export type UserRole = 'admin' | 'staff' | 'duty_manager';

export type Permission =
  | 'rooms.view' | 'rooms.manage' | 'rooms.maintenance' | 'rooms.markClean'
  | 'guests.view' | 'guests.manage'
  | 'bookings.view' | 'bookings.create' | 'bookings.edit' | 'bookings.checkin' | 'bookings.cancel' | 'bookings.delete'
  | 'reports.view' | 'reports.export'
  | 'notifications.view';

export const ALL_PERMISSIONS: Permission[] = [
  'rooms.view', 'rooms.manage', 'rooms.maintenance', 'rooms.markClean',
  'guests.view', 'guests.manage',
  'bookings.view', 'bookings.create', 'bookings.edit', 'bookings.checkin', 'bookings.cancel', 'bookings.delete',
  'reports.view', 'reports.export',
  'notifications.view',
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ALL_PERMISSIONS,
  duty_manager: [
    'rooms.view', 'rooms.maintenance', 'rooms.markClean',
    'guests.view',
    'bookings.view', 'bookings.checkin',
    'reports.view', 'reports.export',
    'notifications.view',
  ],
  staff: [
    'rooms.view', 'rooms.markClean',
    'guests.view', 'guests.manage',
    'bookings.view', 'bookings.create', 'bookings.edit', 'bookings.checkin', 'bookings.cancel',
    'notifications.view',
  ],
};

export function can(role: UserRole | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export const PAGE_PERMISSION: Record<string, Permission> = {
  dashboard: 'rooms.view',
  rooms: 'rooms.view',
  bookings: 'bookings.view',
  guests: 'guests.view',
  reports: 'reports.view',
  notifications: 'notifications.view',
};
