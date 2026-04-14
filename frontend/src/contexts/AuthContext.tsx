import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  permissions: string[];
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (key: string) => boolean;
  isSuperAdmin: () => boolean;
}

const SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('loginAt');
    setUser(null);
  };

  const scheduleAutoLogout = (loginAt: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const remaining = SESSION_MS - (Date.now() - loginAt);
    if (remaining <= 0) {
      clearSession();
      return;
    }
    timerRef.current = setTimeout(() => clearSession(), remaining);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const loginAt = Number(localStorage.getItem('loginAt') || 0);

    if (!token) {
      setLoading(false);
      return;
    }

    // Expired while the tab was closed
    if (loginAt && Date.now() - loginAt >= SESSION_MS) {
      clearSession();
      setLoading(false);
      return;
    }

    api.get('/auth/me')
      .then((r) => {
        setUser(r.data.user);
        localStorage.setItem('user', JSON.stringify(r.data.user));
        if (loginAt) scheduleAutoLogout(loginAt);
      })
      .catch(() => clearSession())
      .finally(() => setLoading(false));

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const login = async (username: string, password: string) => {
    const r = await api.post('/auth/login', { username, password });
    const loginAt = Date.now();
    localStorage.setItem('token', r.data.token);
    localStorage.setItem('user', JSON.stringify(r.data.user));
    localStorage.setItem('loginAt', String(loginAt));
    setUser(r.data.user);
    scheduleAutoLogout(loginAt);
  };

  const logout = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    clearSession();
  };

  const hasPermission = (key: string): boolean => {
    if (!user) return false;
    return user.role === 'superadmin' || (user.permissions ?? []).includes(key);
  };

  const isSuperAdmin = (): boolean => {
    return user?.role === 'superadmin';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
