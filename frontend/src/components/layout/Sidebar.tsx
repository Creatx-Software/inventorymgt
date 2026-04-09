import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Laptop, Monitor, Smartphone, Phone, Server,
  Printer, Network, Package, AlertTriangle, Users, Building2,
  MapPin, Tag, ScrollText, Settings, Boxes,
} from 'lucide-react';
import clsx from 'clsx';

const sections = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Assets',
    items: [
      { to: '/endpoints',       label: 'Endpoints',       icon: Laptop },
      { to: '/monitors',        label: 'Monitors',        icon: Monitor },
      { to: '/mobile-devices',  label: 'Mobile Devices',  icon: Smartphone },
      { to: '/ip-phones',       label: 'IP Phones',       icon: Phone },
      { to: '/servers',         label: 'Servers',         icon: Server },
      { to: '/printers',        label: 'Printers',        icon: Printer },
      { to: '/network-devices', label: 'Network Devices', icon: Network },
      { to: '/other-assets',    label: 'Other Assets',    icon: Package },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/incidents',  label: 'Incidents', icon: AlertTriangle },
      { to: '/audit-logs', label: 'Audit Log', icon: ScrollText },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { to: '/employees',   label: 'Employees',   icon: Users },
      { to: '/departments', label: 'Departments', icon: Building2 },
      { to: '/locations',   label: 'Locations',   icon: MapPin },
      { to: '/vendors',     label: 'Vendors',     icon: Tag },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      <div className="px-6 h-16 flex items-center gap-3 border-b border-slate-200">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-md shadow-brand-500/30">
          <Boxes className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-slate-900 text-sm leading-tight">Inventory</div>
          <div className="text-[11px] text-slate-500 leading-tight">Asset Management</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={clsx('w-4 h-4', isActive && 'text-brand-600')} />
                        {label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
