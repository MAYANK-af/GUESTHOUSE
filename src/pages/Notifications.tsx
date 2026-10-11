import { useEffect, useState } from 'react';
import { supabase, type Notification, type NotificationType } from '@/lib/supabase';
import { Bell, CheckCheck, Trash2, Calendar, LogIn, LogOut, DollarSign, Wrench, Info, Filter } from 'lucide-react';

const typeConfig: Record<NotificationType, { icon: typeof Bell; color: string; bg: string }> = {
  booking_confirmation: { icon: Calendar, color: 'text-sky-600', bg: 'bg-sky-50' },
  check_in_alert: { icon: LogIn, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  check_out_alert: { icon: LogOut, color: 'text-amber-600', bg: 'bg-amber-50' },
  payment_reminder: { icon: DollarSign, color: 'text-red-600', bg: 'bg-red-50' },
  maintenance: { icon: Wrench, color: 'text-violet-600', bg: 'bg-violet-50' },
  general: { icon: Info, color: 'text-slate-600', bg: 'bg-slate-50' },
};

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => { loadNotifications(); }, []);

  async function loadNotifications() {
    setLoading(true);
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    setNotifications(data as Notification[] ?? []);
    setLoading(false);
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    loadNotifications();
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).neq('is_read', true);
    loadNotifications();
  }

  async function handleDelete(id: string) {
    await supabase.from('notifications').delete().eq('id', id);
    loadNotifications();
  }

  const filtered = filter === 'all' ? notifications : filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications.filter(n => n.type === filter);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications & Alerts</h1>
          <p className="text-sm text-slate-500 mt-1">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary">
            <CheckCheck className="w-4 h-4" />
            Mark All Read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Filter</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread' },
            { value: 'booking_confirmation', label: 'Bookings' },
            { value: 'check_in_alert', label: 'Check-ins' },
            { value: 'check_out_alert', label: 'Check-outs' },
            { value: 'payment_reminder', label: 'Payments' },
            { value: 'maintenance', label: 'Maintenance' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f.value ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications list */}
      <div className="space-y-3">
        {filtered.map(notification => {
          const config = typeConfig[notification.type] ?? typeConfig.general;
          return (
            <div
              key={notification.id}
              className={`card p-4 flex items-start gap-4 transition-all hover:shadow-md ${!notification.is_read ? 'ring-sky-200 bg-sky-50/30' : ''}`}
            >
              <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                <config.icon className={`w-5 h-5 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-slate-900 text-sm">{notification.title}</h4>
                  {!notification.is_read && <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />}
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{notification.message}</p>
                <p className="text-xs text-slate-400 mt-2">{new Date(notification.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {!notification.is_read && (
                  <button onClick={() => markAsRead(notification.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-sky-600" title="Mark as read">
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => handleDelete(notification.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card p-12 text-center">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No notifications to display</p>
        </div>
      )}
    </div>
  );
}
