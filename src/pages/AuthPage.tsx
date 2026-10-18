import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Building2, Lock, Mail, User, Shield, Loader2, Hotel, Calendar, Users, Bell } from 'lucide-react';
import { isMockMode, type UserRole } from '@/lib/supabase';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, role);
      if (error) setError(error);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-sky-700 via-sky-800 to-slate-900">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-sky-400 blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-sky-300 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">GuestHouse Pro</h1>
              <p className="text-sm text-sky-200">Management System</p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold leading-tight mb-3">
                Manage your guest house with elegance and efficiency
              </h2>
              <p className="text-sky-200 text-lg">
                Complete room management, bookings, guest tracking, and reporting — all in one place.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              {[
                { icon: Hotel, label: 'Room Management' },
                { icon: Calendar, label: 'Booking Calendar' },
                { icon: Users, label: 'Guest Profiles' },
                { icon: Bell, label: 'Smart Alerts' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3 ring-1 ring-white/10">
                  <Icon className="w-5 h-5 text-sky-300" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-sky-300">Secure role-based access for your team</p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-sky-600 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">GuestHouse Pro</h1>
              <p className="text-sm text-slate-500">Management System</p>
            </div>
          </div>

          <div className="card p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              {mode === 'signin' ? 'Sign in to manage your guest house' : 'Sign up to get started with GuestHouse Pro'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="label-field">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="input-field pl-10"
                      placeholder="Rajesh Sharma"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label-field">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-10"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="label-field">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-10"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {mode === 'signup' && isMockMode && (
                <div>
                  <label className="label-field">Role (demo mode only)</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="input-field pl-10 appearance-none"
                    >
                      <option value="admin">Admin</option>
                      <option value="duty_manager">Duty Manager</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {mode === 'signin' && isMockMode && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 text-center">
                  Instant Demo Access
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => signIn('admin@guesthouse.com', 'password')}
                    className="py-2 px-2 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-sky-50 hover:border-sky-300 text-slate-700 shadow-sm transition-all text-center"
                  >
                    👑 Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => signIn('staff@guesthouse.com', 'password')}
                    className="py-2 px-2 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-sky-50 hover:border-sky-300 text-slate-700 shadow-sm transition-all text-center"
                  >
                    👔 Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => signIn('manager@guesthouse.com', 'password')}
                    className="py-2 px-2 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-sky-50 hover:border-sky-300 text-slate-700 shadow-sm transition-all text-center"
                  >
                    🔧 Manager
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 text-center text-sm text-slate-500">
              {mode === 'signin' ? (
                <>
                  Don't have an account?{' '}
                  <button onClick={() => { setMode('signup'); setError(null); }} className="font-semibold text-sky-600 hover:text-sky-700">
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button onClick={() => { setMode('signin'); setError(null); }} className="font-semibold text-sky-600 hover:text-sky-700">
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
