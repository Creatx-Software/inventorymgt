import { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import { Loader2 } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  '/':                'Dashboard',
  '/endpoints':       'Endpoints',
  '/monitors':        'Monitors',
  '/mobile-devices':  'Mobile Devices',
  '/ip-phones':       'IP Phones',
  '/servers':         'Servers',
  '/printers':        'Printers',
  '/network-devices': 'Network Devices',
  '/other-assets':    'Other Assets',
  '/incidents':       'Network Incidents',
  '/audit-logs':      'Audit Logs',
  '/employees':       'Employees',
  '/departments':     'Departments',
  '/locations':       'Locations',
  '/vendors':         'Vendors',
  '/settings':        'Settings',
  '/users':           'User Management',
  '/roles':           'Roles & Permissions',
  '/approvals':       'Pending Approvals',
  '/warranty':        'Warranty',
  '/consumables':     'Consumable Stock',
};

const STORAGE_KEY = 'sidebar:collapsed';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const label = PAGE_TITLES[location.pathname] ?? 'IBN Inventory';
    document.title = `${label} — ICICI Inventory`;
  }, [location.pathname]);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
