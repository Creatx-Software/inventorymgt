import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/table/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { employeesApi, departmentsApi, locationsApi } from '../api/lookups';
import { api } from '../api/client';
import type { Employee, Department, Location } from '../types/api';
import { AlertCircle, CheckCircle2, Laptop, Monitor, Smartphone, Phone, Server, Printer, Network, Package, Loader2, ExternalLink, PackageOpen, Copy, Check } from 'lucide-react';
import { consumablesApi } from '../api/consumables';
import type { ConsumableAssignment } from '../types/api';

interface AssetGroup {
  key: string;
  label: string;
  count: number;
  assets: { id: number; serial_number: string; asset_name: string | null; model: string | null; status_name: string; status_color: string }[];
}

interface EmployeeAssets {
  totalCount: number;
  groups: AssetGroup[];
}

const typeIcons: Record<string, any> = {
  endpoint: Laptop, monitor: Monitor, mobile_device: Smartphone, ip_phone: Phone,
  server: Server, printer: Printer, network_device: Network, other_asset: Package,
};

const typeRoutes: Record<string, string> = {
  endpoint: '/endpoints', monitor: '/monitors', mobile_device: '/mobile-devices', ip_phone: '/ip-phones',
  server: '/servers', printer: '/printers', network_device: '/network-devices', other_asset: '/other-assets',
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button type="button" onClick={handleCopy} className="ml-1.5 text-slate-400 hover:text-brand-600 transition-colors" title="Copy to clipboard">
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [tab, setTab] = useState<'details' | 'assets' | 'consumables'>('details');
  const [form, setForm] = useState({
    employee_code: '', full_name: '', email: '', department_id: '', location_id: '', is_active: true, needs_review: false,
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [assets, setAssets] = useState<EmployeeAssets | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [consumables, setConsumables] = useState<import('../types/api').EmployeeConsumable[] | null>(null);
  const [consumablesLoading, setConsumablesLoading] = useState(false);

  const fetcher = useCallback((p: any) => employeesApi.list(p), [reloadKey]);

  useEffect(() => {
    departmentsApi.list({ pageSize: 500 }).then((r) => setDepartments(r.data)).catch(() => {});
    locationsApi.list({ pageSize: 500 }).then((r) => setLocations(r.data)).catch(() => {});
  }, []);

  const deptName = (id: number | null) => departments.find((d) => d.id === id)?.name || '—';
  const locName = (id: number | null) => locations.find((l) => l.id === id)?.name || '—';

  const columns: ColumnDef<Employee, any>[] = [
    { accessorKey: 'id', header: 'ID', size: 70 },
    { accessorKey: 'employee_code', header: 'Employee ID', size: 140, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
    {
      accessorKey: 'full_name', header: 'Full Name', size: 240,
      cell: (i) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{i.getValue() as string}</span>
          {!!i.row.original.needs_review && (
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
          )}
        </div>
      ),
    },
    { accessorKey: 'email', header: 'Email', size: 240, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
    { accessorKey: 'department_id', header: 'Department', size: 180, cell: (i) => deptName(i.getValue() as number | null) },
    { accessorKey: 'location_id', header: 'Location', size: 200, cell: (i) => locName(i.getValue() as number | null) },
    {
      accessorKey: 'is_active', header: 'Active', size: 90,
      cell: (i) => i.getValue() ? (
        <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">Active</span>
      ) : (
        <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border bg-slate-50 text-slate-500 border-slate-200">Inactive</span>
      ),
    },
  ];

  const openNew = () => {
    setEditing(null);
    setTab('details');
    setAssets(null);
    setConsumables(null);
    setForm({ employee_code: '', full_name: '', email: '', department_id: '', location_id: '', is_active: true, needs_review: false });
    setOpen(true);
  };

  const openEdit = (row: Employee) => {
    setEditing(row);
    setTab('details');
    setAssets(null);
    setConsumables(null);
    setForm({
      employee_code: row.employee_code || '',
      full_name: row.full_name,
      email: row.email || '',
      department_id: row.department_id ? String(row.department_id) : '',
      location_id: row.location_id ? String(row.location_id) : '',
      is_active: row.is_active,
      needs_review: row.needs_review,
    });
    setOpen(true);
  };

  const loadAssets = async () => {
    if (!editing) return;
    setAssetsLoading(true);
    try {
      const r = await api.get(`/employees/${editing.id}/assets`);
      setAssets(r.data);
    } finally { setAssetsLoading(false); }
  };

  const loadConsumables = async () => {
    if (!editing) return;
    setConsumablesLoading(true);
    try {
      const data = await consumablesApi.getByEmployee(editing.id);
      setConsumables(data);
    } finally { setConsumablesLoading(false); }
  };

  useEffect(() => {
    if (tab === 'assets' && editing) loadAssets();
    if (tab === 'consumables' && editing) loadConsumables();
  }, [tab, editing]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        employee_code: form.employee_code || null,
        full_name: form.full_name,
        email: form.email || null,
        department_id: form.department_id ? Number(form.department_id) : null,
        location_id: form.location_id ? Number(form.location_id) : null,
        is_active: form.is_active,
        needs_review: form.needs_review,
      };
      if (editing) await employeesApi.update(editing.id, payload as any);
      else await employeesApi.create(payload as any);
      setOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!editing || !confirm(`Delete employee "${editing.full_name}"?`)) return;
    await employeesApi.remove(editing.id);
    setOpen(false);
    setReloadKey((k) => k + 1);
  };

  const bulkMarkReviewed = async (ids: number[]) => {
    await api.post('/employees/bulk-review', { ids });
    setReloadKey((k) => k + 1);
  };

  return (
    <>
      <DataTable<Employee>
        title="Employees"
        subtitle="People assets are assigned to"
        columns={columns}
        fetcher={fetcher}
        onCreate={openNew}
        onRowClick={openEdit}
        onBulkDelete={async (ids) => { await employeesApi.bulkDelete(ids); setReloadKey((k) => k + 1); }}
        onRestore={async (id) => { await employeesApi.restore(id); setReloadKey((k) => k + 1); }}
        stickyColumnIds={['full_name']}
        viewKey="employees"
        extraActions={({ selectedIds }) => (
          <BulkReviewButton selectedIds={selectedIds} onBulkReview={bulkMarkReviewed} />
        )}
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Employee' : 'New Employee'}
        subtitle={editing ? (editing.employee_code || 'No ID') : 'Add a new employee'}
        width="lg"
        footer={
          <div className="flex justify-between">
            <div>{editing && <button onClick={remove} className="btn bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">Delete</button>}</div>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving || !form.full_name} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        }
      >
        {/* Tabs */}
        {editing && (
          <div className="flex gap-1 mb-5 border-b border-slate-200 -mx-6 px-6">
            <button
              onClick={() => setTab('details')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === 'details' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setTab('assets')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-1.5 ${
                tab === 'assets' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Assigned Assets
              {assets && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-brand-100 text-brand-700">
                  {assets.totalCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('consumables')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-1.5 ${
                tab === 'consumables' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <PackageOpen className="w-3.5 h-3.5" />
              Consumables
              {consumables && consumables.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-brand-100 text-brand-700">
                  {consumables.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Details tab */}
        {tab === 'details' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <label className="label flex items-center">Employee ID <CopyButton value={form.employee_code} /></label>
              <input className="input" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />
            </div>
            <div className="col-span-1">
              <label className="label flex items-center">Full Name * <CopyButton value={form.full_name} /></label>
              <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus />
            </div>
            <div className="col-span-2">
              <label className="label flex items-center">Email <CopyButton value={form.email} /></label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="col-span-1">
              <label className="label flex items-center">Department <CopyButton value={deptName(form.department_id ? Number(form.department_id) : null)} /></label>
              <select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">— None —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label className="label flex items-center">Location <CopyButton value={locName(form.location_id ? Number(form.location_id) : null)} /></label>
              <select className="input" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })}>
                <option value="">— None —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Active
              </label>
            </div>
            <div className="col-span-1">
              {!!form.needs_review && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, needs_review: false })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Needs review — click to clear
                </button>
              )}
              {editing && !form.needs_review && !!editing.needs_review && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Will be marked as reviewed on save
                </span>
              )}
            </div>
          </div>
        )}

        {/* Consumables tab */}
        {tab === 'consumables' && (
          <div>
            {consumablesLoading && (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-brand-600" /></div>
            )}
            {!consumablesLoading && consumables && consumables.length === 0 && (
              <div className="text-center text-sm text-slate-400 py-12">
                No consumable items currently held by this employee.
              </div>
            )}
            {!consumablesLoading && consumables && consumables.length > 0 && (
              <div className="space-y-2">
                {consumables.map((item) => (
                  <div key={item.consumable_item_id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">{item.name}</div>
                      {item.category && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 mt-0.5 inline-block">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-sm font-semibold text-slate-900">
                        {item.net_quantity} <span className="font-normal text-slate-500">{item.unit}</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {item.total_assigned} assigned · {item.total_returned} returned
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Assigned Assets tab */}
        {tab === 'assets' && (
          <div>
            {assetsLoading && (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-brand-600" /></div>
            )}
            {!assetsLoading && assets && assets.totalCount === 0 && (
              <div className="text-center text-sm text-slate-400 py-12">
                No assets assigned to this employee.
              </div>
            )}
            {!assetsLoading && assets && assets.groups.map((group) => {
              const Icon = typeIcons[group.key] || Package;
              const route = typeRoutes[group.key] || '/';
              return (
                <div key={group.key} className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-900">{group.label}</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-600">{group.count}</span>
                  </div>
                  <div className="space-y-1">
                    {group.assets.map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => { setOpen(false); navigate(`${route}?openId=${asset.id}`); }}
                        className="w-full text-left card p-3 hover:shadow-md hover:-translate-y-0.5 transition-all group flex items-center gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {asset.asset_name || asset.serial_number}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono">{asset.serial_number}</span>
                            {asset.model && <span>· {asset.model}</span>}
                          </div>
                        </div>
                        <span
                          className="inline-block px-2 py-0.5 text-[11px] font-medium rounded-full border shrink-0"
                          style={{
                            backgroundColor: (asset.status_color || '#64748b') + '15',
                            borderColor: (asset.status_color || '#64748b') + '40',
                            color: asset.status_color || '#475569',
                          }}
                        >
                          {asset.status_name}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Drawer>
    </>
  );
}

function BulkReviewButton({ selectedIds, onBulkReview }: { selectedIds: number[]; onBulkReview: (ids: number[]) => Promise<void> }) {
  const [loading, setLoading] = useState(false);

  if (selectedIds.length === 0) return null;

  const handleClick = async () => {
    if (!confirm(`Mark ${selectedIds.length} selected employee(s) as reviewed?`)) return;
    setLoading(true);
    try {
      await onBulkReview(selectedIds);
    } finally { setLoading(false); }
  };

  return (
    <button onClick={handleClick} disabled={loading} className="btn bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
      Mark reviewed ({selectedIds.length})
    </button>
  );
}
