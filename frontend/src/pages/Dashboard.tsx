import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Laptop, Monitor, Smartphone, Server, Printer, Network, Phone, Package,
  AlertTriangle, Users, MapPin, Tag, Activity, UserX, Loader2,
  ArrowRight, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { dashboardApi, type DashboardSummary, type AlertBuckets, type RecentActivity, type ChartsData } from '../api/dashboard';

const assetTypeMeta = [
  { key: 'endpoint',       label: 'Endpoints',       icon: Laptop,     color: 'from-blue-500 to-indigo-600',     path: '/endpoints' },
  { key: 'monitor',        label: 'Monitors',        icon: Monitor,    color: 'from-emerald-500 to-teal-600',    path: '/monitors' },
  { key: 'mobile_device',  label: 'Mobile Devices',  icon: Smartphone, color: 'from-purple-500 to-fuchsia-600',  path: '/mobile-devices' },
  { key: 'server',         label: 'Servers',         icon: Server,     color: 'from-orange-500 to-red-600',      path: '/servers' },
  { key: 'printer',        label: 'Printers',        icon: Printer,    color: 'from-pink-500 to-rose-600',       path: '/printers' },
  { key: 'network_device', label: 'Network Devices', icon: Network,    color: 'from-cyan-500 to-blue-600',       path: '/network-devices' },
  { key: 'ip_phone',       label: 'IP Phones',       icon: Phone,      color: 'from-amber-500 to-orange-600',    path: '/ip-phones' },
  { key: 'other_asset',    label: 'Other Assets',    icon: Package,    color: 'from-slate-500 to-slate-700',     path: '/other-assets' },
];

const actionColor: Record<string, string> = {
  CREATE:  'text-emerald-600',
  UPDATE:  'text-blue-600',
  DELETE:  'text-red-600',
  RESTORE: 'text-purple-600',
  LOGIN:   'text-slate-600',
  IMPORT:  'text-amber-600',
  EXPORT:  'text-indigo-600',
};

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [warranty, setWarranty] = useState<AlertBuckets | null>(null);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [charts, setCharts] = useState<ChartsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardApi.summary(),
      dashboardApi.warranty(),
      dashboardApi.recentActivity(),
      dashboardApi.charts(),
    ]).then(([s, w, a, c]) => {
      setSummary(s); setWarranty(w); setActivity(a); setCharts(c);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const totalWarranty = warranty
    ? warranty.expired.length + warranty.within30.length + warranty.within60.length + warranty.within90.length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of your inventory across all asset types</p>
      </div>

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiBadge label="Total Assets" value={summary?.total || 0} icon={Package} color="from-brand-500 to-indigo-600" />
        <KpiBadge label="Unassigned" value={summary?.unassigned || 0} icon={UserX} color="from-amber-500 to-orange-600" />
        <KpiBadge label="Employees" value={summary?.employees || 0} icon={Users} color="from-emerald-500 to-teal-600" />
        <KpiBadge label="Locations" value={summary?.locations || 0} icon={MapPin} color="from-pink-500 to-rose-600" />
        <KpiBadge label="Vendors" value={summary?.vendors || 0} icon={Tag} color="from-cyan-500 to-blue-600" />
      </div>

      {/* Asset-type cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {assetTypeMeta.map(({ key, label, icon: Icon, color, path }) => (
          <Link key={key} to={path} className="card p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</div>
                <div className="text-3xl font-bold text-slate-900 mt-2">{summary?.byType[key] ?? 0}</div>
                <div className="flex items-center gap-1 mt-2 text-xs text-brand-600 opacity-0 group-hover:opacity-100 transition">
                  View all <ArrowRight className="w-3 h-3" />
                </div>
              </div>
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main grid: Warranty alerts + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Warranty Alerts</h2>
              <p className="text-xs text-slate-500 mt-0.5">Assets with expired or expiring warranty</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <AlertPill label="Expired" count={warranty?.expired.length || 0} color="red" />
            <AlertPill label="< 30 days" count={warranty?.within30.length || 0} color="orange" />
            <AlertPill label="< 60 days" count={warranty?.within60.length || 0} color="amber" />
            <AlertPill label="< 90 days" count={warranty?.within90.length || 0} color="yellow" />
          </div>

          {totalWarranty === 0 ? (
            <div className="text-center text-sm text-slate-400 py-12">
              All assets have valid warranties 🎉
            </div>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {([
                { bucket: warranty?.expired || [], label: 'Expired', dot: 'bg-red-500' },
                { bucket: warranty?.within30 || [], label: '< 30 days', dot: 'bg-orange-500' },
                { bucket: warranty?.within60 || [], label: '< 60 days', dot: 'bg-amber-500' },
                { bucket: warranty?.within90 || [], label: '< 90 days', dot: 'bg-yellow-500' },
              ]).map(({ bucket, dot }) =>
                bucket.slice(0, 10).map((a) => (
                  <div key={`${a.asset_table}-${a.id}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50">
                    <div className={`w-2 h-2 rounded-full ${dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {a.asset_name || a.serial_number}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">{a.serial_number}</div>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3" />
                      {new Date(a.expiry_date).toLocaleDateString('en-GB')}
                    </div>
                    <div className={`text-xs font-medium shrink-0 ${a.days_remaining < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {a.days_remaining < 0 ? `${Math.abs(a.days_remaining)}d ago` : `in ${a.days_remaining}d`}
                    </div>
                  </div>
                )),
              )}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest changes</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center">
              <Activity className="w-5 h-5 text-brand-600" />
            </div>
          </div>
          {activity.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-12">No activity yet</div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {activity.map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                    {(a.user_full_name || a.username || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-700">
                      <span className="font-medium">{a.user_full_name || a.username || 'System'}</span>{' '}
                      <span className={`font-medium ${actionColor[a.action] || ''}`}>{a.action.toLowerCase()}</span>{' '}
                      <span className="font-mono">{a.entity_type}</span>
                      {a.entity_id != null && <span className="text-slate-500"> #{a.entity_id}</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Assets by Status" subtitle="Distribution across asset states">
          {charts && charts.byStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={charts.byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
                  {charts.byStatus.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Locations" subtitle="Assets per office / data centre">
          {charts && charts.byLocation.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.byLocation} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={120} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Vendors" subtitle="Most used manufacturers">
          {charts && charts.byVendor.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.byVendor} margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Departments" subtitle="Assets owned by department">
          {charts && charts.byDepartment.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.byDepartment} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={120} />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
      </div>
    </div>
  );
}

function KpiBadge({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider truncate">{label}</div>
        <div className="text-xl font-bold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function AlertPill({ label, count, color }: { label: string; count: number; color: 'red' | 'orange' | 'amber' | 'yellow' }) {
  const colors = {
    red:    'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${colors[color]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-0.5">{count}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return <div className="text-center text-sm text-slate-400 py-20">No data available</div>;
}

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 604800) return `${Math.floor(d / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB');
}
