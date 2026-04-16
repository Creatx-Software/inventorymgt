import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { approvalsApi } from '../api/approvals';
import { employeesApi, vendorsApi, locationsApi, departmentsApi } from '../api/lookups';
import { assetStatusesApi } from '../api/assets';
import type { Employee, Vendor, Location, Department } from '../types/api';
import type { AssetStatus } from '../types/assets';
import { Loader2, CheckCircle, XCircle, Clock, X, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

interface PendingApproval {
  id: number;
  asset_type: string;
  asset_id: number;
  changed_by_user_id: number;
  changed_by_name: string;
  changed_by_username: string;
  before_data: Record<string, any>;
  after_data: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_user_id: number | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  endpoint: 'Endpoints',
  monitor: 'Monitors',
  mobile_device: 'Mobile Devices',
  ip_phone: 'IP Phones',
  server: 'Servers',
  printer: 'Printers',
  network_device: 'Network Devices',
  other_asset: 'Other Assets',
};

const ASSET_TYPE_BADGE_COLORS: Record<string, string> = {
  endpoint: 'bg-blue-100 text-blue-700',
  monitor: 'bg-indigo-100 text-indigo-700',
  mobile_device: 'bg-purple-100 text-purple-700',
  ip_phone: 'bg-violet-100 text-violet-700',
  server: 'bg-orange-100 text-orange-700',
  printer: 'bg-teal-100 text-teal-700',
  network_device: 'bg-cyan-100 text-cyan-700',
  other_asset: 'bg-slate-100 text-slate-700',
};

// Fields to skip in the diff view
const SKIP_FIELD_SUFFIXES = ['_name', '_color', '_code'];
const SKIP_FIELD_EXACT = new Set([
  'id', 'has_pending_approval', 'updated_at', 'created_at',
  'vendor_name', 'location_name', 'department_name',
  'employee_name', 'employee_code', 'status_name', 'status_color',
]);

function shouldSkipField(key: string): boolean {
  if (SKIP_FIELD_EXACT.has(key)) return true;
  if (SKIP_FIELD_SUFFIXES.some((suffix) => key.endsWith(suffix))) return true;
  return false;
}

function getDiffFields(before: Record<string, any>, after: Record<string, any>): Array<{ field: string; before: any; after: any; changed: boolean }> {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const rows: Array<{ field: string; before: any; after: any; changed: boolean }> = [];

  for (const key of allKeys) {
    if (shouldSkipField(key)) continue;
    const bVal = before[key] ?? null;
    const aVal = after[key] ?? null;
    rows.push({ field: key, before: bVal, after: aVal, changed: String(bVal) !== String(aVal) });
  }

  // Sort: changed fields first, then alphabetical
  rows.sort((a, b) => {
    if (a.changed !== b.changed) return a.changed ? -1 : 1;
    return a.field.localeCompare(b.field);
  });

  return rows;
}

function getChangedCount(rows: Array<{ changed: boolean }>): number {
  return rows.filter((r) => r.changed).length;
}


function humanizeField(field: string): string {
  const FK_LABELS: Record<string, string> = {
    employee_id: 'Employee',
    vendor_id: 'Vendor / Make',
    location_id: 'Location',
    department_id: 'Department',
    status_id: 'Status',
  };
  if (FK_LABELS[field]) return FK_LABELS[field];
  return field
    .replace(/_id$/, ' ID')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface DiffDrawerProps {
  approval: PendingApproval;
  employees: Employee[];
  vendors: Vendor[];
  locations: Location[];
  departments: Department[];
  statuses: AssetStatus[];
  onClose: () => void;
  onApproved: (id: number) => void;
  onRejected: (id: number) => void;
}

function DiffDrawer({ approval, employees, vendors, locations, departments, statuses, onClose, onApproved, onRejected }: DiffDrawerProps) {
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const before = typeof approval.before_data === 'string'
    ? JSON.parse(approval.before_data)
    : approval.before_data;
  const after = typeof approval.after_data === 'string'
    ? JSON.parse(approval.after_data)
    : approval.after_data;

  const allFields = getDiffFields(before, after);
  const changedCount = getChangedCount(allFields);

  const resolveFieldValue = (field: string, value: any): string => {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    if (field === 'employee_id') {
      const emp = employees.find((e) => e.id === n);
      if (!emp) return String(value);
      return emp.employee_code ? `${emp.full_name} (${emp.employee_code})` : emp.full_name;
    }
    if (field === 'vendor_id') return vendors.find((v) => v.id === n)?.name || String(value);
    if (field === 'location_id') return locations.find((l) => l.id === n)?.name || String(value);
    if (field === 'department_id') return departments.find((d) => d.id === n)?.name || String(value);
    if (field === 'status_id') return statuses.find((s) => s.id === n)?.name || String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  const handleApprove = async () => {
    setActionLoading('approve');
    setError(null);
    try {
      await approvalsApi.approve(approval.id);
      onApproved(approval.id);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    setActionLoading('reject');
    setError(null);
    try {
      await approvalsApi.reject(approval.id, rejectNotes || undefined);
      onRejected(approval.id);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative bg-white w-full max-w-xl flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="px-6 h-16 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <div className="font-semibold text-slate-900">Review Change</div>
            <div className="text-xs text-slate-500">
              {ASSET_TYPE_LABELS[approval.asset_type] || approval.asset_type} #{approval.asset_id}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Meta info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500 mb-1">Asset Type</div>
              <span className={clsx(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                ASSET_TYPE_BADGE_COLORS[approval.asset_type] || 'bg-slate-100 text-slate-700',
              )}>
                {ASSET_TYPE_LABELS[approval.asset_type] || approval.asset_type}
              </span>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Asset ID</div>
              <div className="font-mono font-medium">#{approval.asset_id}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Changed By</div>
              <div className="font-medium text-slate-900">{approval.changed_by_name}</div>
              <div className="text-xs text-slate-500">@{approval.changed_by_username}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Submitted</div>
              <div className="text-slate-700">{new Date(approval.created_at).toLocaleDateString('en-GB')}</div>
              <div className="text-xs text-slate-500">{new Date(approval.created_at).toLocaleTimeString('en-GB')}</div>
            </div>
          </div>

          {/* Diff table */}
          <div>
            <div className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              All Fields
              {changedCount > 0 && (
                <span className="text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  {changedCount} changed
                </span>
              )}
            </div>

            {allFields.length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center border border-slate-200 rounded-lg">
                No fields available
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-1/3">Field</th>
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-1/3">Before</th>
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-1/3">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allFields.map((row) => (
                      <tr key={row.field} className={clsx('border-b border-slate-100 last:border-0', row.changed && 'bg-amber-50/40')}>
                        <td className={clsx('px-3 py-2.5 text-xs font-medium', row.changed ? 'text-amber-700' : 'text-slate-500')}>
                          {humanizeField(row.field)}
                          {row.changed && <span className="ml-1.5 text-[10px] text-amber-500 font-semibold uppercase tracking-wider">changed</span>}
                        </td>
                        <td className={clsx('px-3 py-2.5 text-xs font-mono', row.changed ? 'bg-red-50 text-red-700' : 'text-slate-500')}>
                          {resolveFieldValue(row.field, row.before)}
                        </td>
                        <td className={clsx('px-3 py-2.5 text-xs font-mono', row.changed ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500')}>
                          {resolveFieldValue(row.field, row.after)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Reject form */}
          {showRejectForm && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Rejection notes <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                className="input w-full resize-none h-24"
                placeholder="Provide a reason for rejecting this change..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 shrink-0 space-y-3">
          {!showRejectForm ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleApprove}
                disabled={actionLoading !== null}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'approve' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Approve
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={actionLoading !== null}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleReject}
                disabled={actionLoading !== null}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'reject' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Confirm Reject
              </button>
              <button
                onClick={() => { setShowRejectForm(false); setRejectNotes(''); }}
                disabled={actionLoading !== null}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const { isSuperAdmin } = useAuth();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [statuses, setStatuses] = useState<AssetStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await approvalsApi.list();
      setApprovals(r.data || []);
    } catch (e) {
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    Promise.all([
      employeesApi.list({ pageSize: 1000 }),
      vendorsApi.list({ pageSize: 500 }),
      locationsApi.list({ pageSize: 500 }),
      departmentsApi.list({ pageSize: 500 }),
      assetStatusesApi.list(),
    ]).then(([e, v, l, d, s]) => {
      setEmployees(e.data);
      setVendors(v.data);
      setLocations(l.data);
      setDepartments(d.data);
      setStatuses(s);
    }).catch(() => {});
  }, []);

  // Count per asset type
  const countByType: Record<string, number> = {};
  for (const a of approvals) {
    countByType[a.asset_type] = (countByType[a.asset_type] || 0) + 1;
  }

  const assetTypes = Object.keys(ASSET_TYPE_LABELS);

  // Filtered list
  const filtered = activeFilter === 'all'
    ? approvals
    : approvals.filter((a) => a.asset_type === activeFilter);

  const selectedApproval = selectedId != null
    ? approvals.find((a) => a.id === selectedId) || null
    : null;

  const handleApproved = (id: number) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    setSelectedId(null);
  };

  const handleRejected = (id: number) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    setSelectedId(null);
  };

  if (!isSuperAdmin()) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="text-slate-400 text-lg font-medium">Access Denied</div>
          <p className="text-sm text-slate-500">Only superadmins can access the Approvals page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pending Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and approve or reject asset changes made by non-superadmin users
          </p>
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Asset type filter bar */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={clsx(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition',
              activeFilter === 'all'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            )}
          >
            All
            <span className={clsx(
              'text-[11px] font-semibold px-1.5 py-0.5 rounded-full',
              activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-700',
            )}>
              {approvals.length}
            </span>
          </button>

          {assetTypes.map((type) => {
            const count = countByType[type] || 0;
            const isActive = activeFilter === type;
            return (
              <button
                key={type}
                onClick={() => setActiveFilter(type)}
                className={clsx(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : count > 0
                    ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                )}
              >
                {ASSET_TYPE_LABELS[type]}
                {count > 0 && (
                  <span className={clsx(
                    'text-[11px] font-semibold px-1.5 py-0.5 rounded-full',
                    isActive ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-800',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="card overflow-hidden">
        {loading && approvals.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-400" />
            <div className="text-lg font-semibold text-slate-700">No pending approvals</div>
            <p className="text-sm text-slate-500 text-center max-w-xs">
              {activeFilter === 'all'
                ? 'There are no changes waiting for review.'
                : `No pending changes for ${ASSET_TYPE_LABELS[activeFilter] || activeFilter}.`}
            </p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-380px)]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Asset Type</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Changed By</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Changes</th>
                  <th className="px-4 py-3 border-b border-slate-200 w-24" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((approval) => {
                  const before = typeof approval.before_data === 'string'
                    ? JSON.parse(approval.before_data)
                    : approval.before_data;
                  const after = typeof approval.after_data === 'string'
                    ? JSON.parse(approval.after_data)
                    : approval.after_data;
                  const diffCount = getChangedCount(getDiffFields(before, after));

                  return (
                    <tr
                      key={approval.id}
                      className="border-b border-slate-100 hover:bg-brand-50/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className={clsx(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          ASSET_TYPE_BADGE_COLORS[approval.asset_type] || 'bg-slate-100 text-slate-700',
                        )}>
                          {ASSET_TYPE_LABELS[approval.asset_type] || approval.asset_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{approval.changed_by_name}</div>
                        <div className="text-xs text-slate-500">@{approval.changed_by_username}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {new Date(approval.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          {diffCount} field{diffCount !== 1 ? 's' : ''} changed
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedId(approval.id)}
                          className="btn-secondary text-xs px-3 py-1.5"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-sm text-slate-500">
            Showing {filtered.length} pending approval{filtered.length !== 1 ? 's' : ''}
            {activeFilter !== 'all' && ` for ${ASSET_TYPE_LABELS[activeFilter] || activeFilter}`}
          </div>
        )}
      </div>

      {/* Diff drawer */}
      {selectedApproval && (
        <DiffDrawer
          approval={selectedApproval}
          employees={employees}
          vendors={vendors}
          locations={locations}
          departments={departments}
          statuses={statuses}
          onClose={() => setSelectedId(null)}
          onApproved={handleApproved}
          onRejected={handleRejected}
        />
      )}
    </div>
  );
}
