import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { supabase, type Notification } from '@/lib/supabase';
import AuthPage from '@/pages/AuthPage';
import Layout, { type PageKey } from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Rooms from '@/pages/Rooms';
import Bookings from '@/pages/Bookings';
import Guests from '@/pages/Guests';
import Reports from '@/pages/Reports';
import Notifications from '@/pages/Notifications';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { session, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!session) return;

    async function loadUnread() {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);
      setUnreadCount(count ?? 0);
    }
    loadUnread();

    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, loadUnread)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  const pages: Record<PageKey, React.ReactNode> = {
    dashboard: <Dashboard />,
    rooms: <Rooms />,
    bookings: <Bookings />,
    guests: <Guests />,
    reports: <Reports />,
    notifications: <Notifications />,
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage} unreadCount={unreadCount}>
      {pages[currentPage]}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
