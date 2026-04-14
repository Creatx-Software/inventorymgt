import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User2, Loader2 } from 'lucide-react';

export default function Login() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-50 via-brand-50 to-indigo-100 relative overflow-hidden">
      {/* Decorative blurs */}
      <div className="absolute top-0 -left-32 w-96 h-96 bg-brand-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      <div className="absolute bottom-0 -right-32 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />

      <div className="relative w-full max-w-md">
        <div className="card p-8">
          <div className="flex flex-col items-center mb-8">
            <img src="/IBN_BIG.svg" alt="IBN" className="h-16 w-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900">Inventory Management</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to access your assets</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="label">Username or Email</label>
              <div className="relative">
                <User2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="input pl-9"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  className="input pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          UK & Germany Asset Inventory · v1.0
        </p>
        <p className="text-center text-xs text-slate-400 mt-2">
          Design & Developed by:{' '}
          <a
            href="https://creatxsoftware.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-600 underline-offset-2"
          >
            creatxsoftware.com
          </a>
        </p>
      </div>
    </div>
  );
}
