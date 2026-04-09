import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User as UserIcon, KeyRound, Loader2, CheckCircle2, AlertCircle, Keyboard } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (next.length < 8) { setMessage({ type: 'error', text: 'New password must be at least 8 characters' }); return; }
    if (next !== confirm) { setMessage({ type: 'error', text: 'Passwords do not match' }); return; }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e: any) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to change password' });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account and preferences</p>
      </div>

      {/* Account info */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-md shadow-brand-500/30">
            <UserIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">Account</div>
            <div className="text-xs text-slate-500">Your user profile</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Full Name</div>
            <div className="font-medium text-slate-900 mt-0.5">{user?.full_name}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Username</div>
            <div className="font-medium text-slate-900 mt-0.5">{user?.username}</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Email</div>
            <div className="font-medium text-slate-900 mt-0.5">{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/30">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">Change Password</div>
            <div className="text-xs text-slate-500">Minimum 8 characters</div>
          </div>
        </div>

        <form onSubmit={onChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="label">Current Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="password" className="input pl-9" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="password" className="input pl-9" value={next} onChange={(e) => setNext(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="password" className="input pl-9" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
          </div>

          {message && (
            <div className={`rounded-lg px-3 py-2 text-sm flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Keyboard shortcuts */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md">
            <Keyboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">Keyboard Shortcuts</div>
            <div className="text-xs text-slate-500">Work faster with the keyboard</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Shortcut keys={['/']} label="Focus search in any table" />
          <Shortcut keys={['Esc']} label="Close drawer or modal" />
          <Shortcut keys={['Enter']} label="Submit forms" />
          <Shortcut keys={['Tab']} label="Navigate between fields" />
        </div>
      </div>
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50">
      <div className="flex gap-1">
        {keys.map((k) => (
          <kbd key={k} className="px-2 py-0.5 text-xs font-semibold bg-white border border-slate-300 rounded shadow-sm text-slate-700 min-w-[28px] text-center">
            {k}
          </kbd>
        ))}
      </div>
      <span className="text-slate-600">{label}</span>
    </div>
  );
}
