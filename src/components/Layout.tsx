import { useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { can, PAGE_PERMISSION } from '@/lib/permissions';
import { Building2, LayoutDashboard, Hotel, CalendarDays, Users, BarChart3, Bell, LogOut, Menu, X, Shield } from 'lucide-react';

export type PageKey = 'dashboard' | 'rooms' | 'bookings' | 'guests' | 'reports' | 'notifications';

interface LayoutProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
  unreadCount: number;
}

const navItems: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'rooms', label: 'Rooms', icon: Hotel },
  { key: 'bookings', label: 'Bookings', icon: CalendarDays },
  { key: 'guests', label: 'Guests', icon: Users },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'notifications', label: 'Notifications', icon: Bell },
];

export default function Layout({ currentPage, onNavigate, children, unreadCount }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const visibleNav = navItems.filter(({ key }) => can(profile?.role, PAGE_PERMISSION[key]));

  const roleColors: Record<string, string> = {
    admin: 'bg-violet-100 text-violet-700',
    duty_manager: 'bg-amber-100 text-amber-700',
    staff: 'bg-sky-100 text-sky-700',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 bg-white border-r border-slate-200">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900">GuestHouse Pro</h1>
            <p className="text-xs text-slate-500">Management System</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                currentPage === key
                  ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {key === 'notifications' && unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white text-sm font-semibold">
              {profile?.full_name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{profile?.full_name}</p>
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-slate-400" />
                <span className={`text-xs font-medium px-1.5 rounded ${roleColors[profile?.role ?? 'staff']}`}>
                  {profile?.role?.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2.5 mt-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-16 bg-white border-b border-slate-200 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-sm">GuestHouse Pro</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-slate-100">
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 inset-y-0 w-72 bg-white shadow-xl animate-slide-in flex flex-col">
            <div className="flex items-center justify-between px-6 h-16 border-b border-slate-200">
              <span className="font-bold text-slate-900">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-700" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {visibleNav.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => { onNavigate(key); setMobileOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    currentPage === key
                      ? 'bg-sky-50 text-sky-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{label}</span>
                  {key === 'notifications' && unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="px-3 py-4 border-t border-slate-200">
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white text-xs font-semibold">
                  {profile?.full_name?.charAt(0).toUpperCase() ?? 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{profile?.full_name}</p>
                  <p className="text-xs text-slate-500">{profile?.role?.replace('_', ' ')}</p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
