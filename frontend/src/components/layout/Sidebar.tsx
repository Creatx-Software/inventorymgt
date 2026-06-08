import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Laptop, Monitor, Smartphone, Phone, Server,
  Printer, Network, Package, AlertTriangle, Users, Building2,
  MapPin, Tag, ScrollText, Settings, Boxes, ChevronsLeft, ChevronsRight,
  UserCog, ShieldCheck, CheckSquare, ShieldAlert, PackageOpen, StickyNote, Activity,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  requireSuperAdminOr?: string; // show if superadmin OR has this permission
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard_view' },
    ],
  },
  {
    title: 'Assets',
    items: [
      { to: '/endpoints',       label: 'Endpoints',       icon: Laptop,      permission: 'endpoints_view' },
      { to: '/monitors',        label: 'Monitors',        icon: Monitor,     permission: 'monitors_view' },
      { to: '/mobile-devices',  label: 'Mobile Devices',  icon: Smartphone,  permission: 'mobile_devices_view' },
      { to: '/ip-phones',       label: 'IP Phones',       icon: Phone,       permission: 'ip_phones_view' },
      { to: '/servers',         label: 'Servers',         icon: Server,      permission: 'servers_view' },
      { to: '/printers',        label: 'Printers',        icon: Printer,     permission: 'printers_view' },
      { to: '/network-devices', label: 'Network Devices', icon: Network,     permission: 'network_devices_view' },
      { to: '/other-assets',    label: 'Other Assets',    icon: Package,     permission: 'other_assets_view' },
      { to: '/consumables',     label: 'Consumable Stock', icon: PackageOpen, permission: 'consumables_view' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/incidents',  label: 'Incidents',       icon: AlertTriangle, permission: 'incidents_view' },
      { to: '/warranty',   label: 'Warranty & EOL',  icon: ShieldAlert,   permission: 'dashboard_view' },
      { to: '/audit-logs', label: 'Audit Log',        icon: ScrollText,    permission: 'audit_logs_view' },
      { to: '/approvals',  label: 'Approvals',        icon: CheckSquare,   requireSuperAdminOr: 'roles_manage' },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { to: '/employees',   label: 'Employees',   icon: Users,     permission: 'employees_view' },
      { to: '/departments', label: 'Departments', icon: Building2, permission: 'departments_view' },
      { to: '/locations',   label: 'Locations',   icon: MapPin,    permission: 'locations_view' },
      { to: '/vendors',     label: 'Vendors',     icon: Tag,       permission: 'vendors_view' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { to: '/notes',      label: 'Notes',      icon: StickyNote, permission: 'notes_view' },
      { to: '/activities', label: 'Activities',  icon: Activity,   permission: 'activities_view' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/settings', label: 'Settings',          icon: Settings },
      { to: '/users',    label: 'Users',              icon: UserCog,    requireSuperAdminOr: 'users_manage' },
      { to: '/roles',    label: 'Roles & Permissions', icon: ShieldCheck, requireSuperAdminOr: 'roles_manage' },
    ],
  },
];

export default function Sidebar({
  collapsed, onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { hasPermission, isSuperAdmin } = useAuth();

  const isVisible = (item: NavItem): boolean => {
    // No permission constraint — always show (e.g. Settings)
    if (!item.permission && !item.requireSuperAdminOr) return true;
    // requireSuperAdminOr: show if superadmin OR has the named permission
    if (item.requireSuperAdminOr) {
      return isSuperAdmin() || hasPermission(item.requireSuperAdminOr);
    }
    // Regular permission check
    if (item.permission) {
      return hasPermission(item.permission);
    }
    return true;
  };

  return (
    <aside
      className={clsx(
        'shrink-0 bg-white border-r border-slate-200 flex flex-col h-full transition-[width] duration-200 ease-out',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      {/* Brand */}
      <div className={clsx(
        'h-16 flex items-center border-b border-slate-200 relative',
        collapsed ? 'justify-center px-3' : 'gap-3 px-6',
      )}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-md shadow-brand-500/30 shrink-0">
          <Boxes className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-bold text-slate-900 text-sm leading-tight">Inventory</div>
            <div className="text-[11px] text-slate-500 leading-tight">Asset Management</div>
          </div>
        )}
        {/* Collapse toggle — floats on the border */}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-brand-600 hover:border-brand-300 hover:shadow transition z-30"
        >
          {collapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className={clsx('flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-5', collapsed ? 'px-2' : 'px-3')}>
        {sections.map((section) => {
          const visibleItems = section.items.filter(isVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title}>
              {!collapsed ? (
                <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {section.title}
                </div>
              ) : (
                <div className="mx-3 mb-2 h-px bg-slate-100" />
              )}
              <ul className="space-y-0.5">
                {visibleItems.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={to === '/'}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        clsx(
                          'group relative flex items-center rounded-lg text-sm font-medium transition-colors',
                          collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2',
                          isActive
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={clsx('w-4 h-4 shrink-0', isActive && 'text-brand-600')} />
                          {!collapsed && <span className="truncate">{label}</span>}
                          {collapsed && (
                            <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-40">
                              {label}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
