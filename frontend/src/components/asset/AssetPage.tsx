import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../table/DataTable';
import { Drawer } from '../ui/Drawer';
import { CommonFields, emptyCommon, commonToPayload, rowToCommon, type CommonFormState } from './CommonFields';
import { vendorsApi, locationsApi, departmentsApi, employeesApi } from '../../api/lookups';
import { assetStatusesApi, getAssignmentHistory } from '../../api/assets';
import type { Vendor, Location, Department, Employee, ListParams, PaginatedResponse } from '../../types/api';
import type { AssetStatus, AssignmentHistory, AssetCommon } from '../../types/assets';
import { History, Loader2, Upload } from 'lucide-react';
import { ImportModal } from '../import/ImportModal';
import { useAuth } from '../../contexts/AuthContext';

export interface AssetCrudApi<T> {
  list: (p: ListParams) => Promise<PaginatedResponse<T>>;
  create: (data: any) => Promise<T>;
  update: (id: number, data: any) => Promise<T>;
  remove: (id: number) => Promise<void>;
  bulkDelete: (ids: number[]) => Promise<{ deleted: number }>;
  restore: (id: number) => Promise<void>;
  hardDelete: (id: number) => Promise<void>;
  bulkHardDelete: (ids: number[]) => Promise<{ deleted: number }>;
}

export interface AssetPageProps<T extends AssetCommon, ExtraForm extends Record<string, any>> {
  title: string;
  subtitle: string;
  resource: string; // for assignment history endpoint
  assetType: string; // backend asset_type key (e.g. 'endpoint')
  api: AssetCrudApi<T>;
  columns: ColumnDef<T, any>[];
  stickyColumnIds?: string[];
  emptyExtra: ExtraForm;
  extraToPayload: (extra: ExtraForm) => Record<string, any>;
  rowToExtra: (row: T) => ExtraForm;
  renderExtraFields: (extra: ExtraForm, setExtra: (e: ExtraForm) => void, common: CommonFormState) => ReactNode;
  defaultSorting?: { id: string; desc: boolean }[];
}

export function AssetPage<T extends AssetCommon, ExtraForm extends Record<string, any>>({
  title, subtitle, resource, assetType, api, columns, stickyColumnIds,
  emptyExtra, extraToPayload, rowToExtra, renderExtraFields, defaultSorting,
}: AssetPageProps<T, ExtraForm>) {
  const { hasPermission } = useAuth();
  const perm = `${assetType}s`; // e.g. 'endpoint' → 'endpoints'
  const canCreate = hasPermission(`${perm}_create`);
  const canEdit   = hasPermission(`${perm}_edit`);
  const canDelete = hasPermission(`${perm}_delete`);

  const [importOpen, setImportOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [common, setCommon] = useState<CommonFormState>(emptyCommon);
  const [extra, setExtra] = useState<ExtraForm>(emptyExtra);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [history, setHistory] = useState<AssignmentHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Lookups
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statuses, setStatuses] = useState<AssetStatus[]>([]);

  useEffect(() => {
    Promise.all([
      vendorsApi.list({ pageSize: 500 }),
      locationsApi.list({ pageSize: 500 }),
      departmentsApi.list({ pageSize: 500 }),
      employeesApi.list({ pageSize: 1000 }),
      assetStatusesApi.list(),
    ]).then(([v, l, d, e, s]) => {
      setVendors(v.data);
      setLocations(l.data);
      setDepartments(d.data);
      setEmployees(e.data);
      setStatuses(s);
    }).catch(() => {});
  }, []);

  const fetcher = useCallback((p: ListParams) => api.list(p), [api, reloadKey]);

  const openNew = () => {
    setEditing(null);
    setCommon({ ...emptyCommon, status_id: statuses[0] ? String(statuses[0].id) : '' });
    setExtra(emptyExtra);
    setTab('details');
    setOpen(true);
  };

  const openEdit = (row: T) => {
    setEditing(row);
    setCommon(rowToCommon(row));
    setExtra(rowToExtra(row));
    setTab('details');
    setOpen(true);
  };

  const loadHistory = async () => {
    if (!editing) return;
    setHistoryLoading(true);
    try {
      const h = await getAssignmentHistory(resource, editing.id);
      setHistory(h);
    } finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    if (tab === 'history' && editing) loadHistory();
  }, [tab, editing]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...commonToPayload(common), ...extraToPayload(extra) };
      if (editing) await api.update(editing.id, payload);
      else await api.create(payload);
      setOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!editing || !confirm(`Delete asset "${editing.serial_number}"?`)) return;
    await api.remove(editing.id);
    setOpen(false);
    setReloadKey((k) => k + 1);
  };

  return (
    <>
      <DataTable<T>
        title={title}
        subtitle={subtitle}
        columns={columns}
        fetcher={fetcher}
        onCreate={canCreate ? openNew : undefined}
        onRowClick={openEdit}
        onBulkDelete={canDelete ? async (ids) => { await api.bulkDelete(ids); setReloadKey((k) => k + 1); } : undefined}
        onRestore={canEdit ? async (id) => { await api.restore(id); setReloadKey((k) => k + 1); } : undefined}
        onHardDelete={canDelete ? async (id) => { await api.hardDelete(id); setReloadKey((k) => k + 1); } : undefined}
        onBulkHardDelete={canDelete ? async (ids) => { await api.bulkHardDelete(ids); setReloadKey((k) => k + 1); } : undefined}
        stickyColumnIds={stickyColumnIds}
        viewKey={`asset-${assetType}`}
        defaultSorting={defaultSorting}
        extraActions={
          canCreate ? (
            <button onClick={() => setImportOpen(true)} className="btn-secondary">
              <Upload className="w-4 h-4" /> Import
            </button>
          ) : undefined
        }
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        assetType={assetType}
        title={title}
        onSuccess={() => setReloadKey((k) => k + 1)}
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${title.replace(/s$/, '')}` : `New ${title.replace(/s$/, '')}`}
        subtitle={editing ? `${editing.serial_number}` : 'Add a new asset'}
        width="lg"
        footer={
          <div className="flex justify-between">
            <div>{editing && canDelete && (
              <button onClick={remove} className="btn bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">Delete</button>
            )}</div>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
              {(editing ? canEdit : canCreate) && (
                <button onClick={save} disabled={saving || !common.status_id} className="btn-primary">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>
        }
      >
        {editing && (
          <div className="flex gap-1 mb-5 border-b border-slate-200 -mx-6 px-6">
            <button
              onClick={() => setTab('details')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === 'details' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Details
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-1.5 ${tab === 'history' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <History className="w-3.5 h-3.5" /> Assignment History
            </button>
          </div>
        )}

        {tab === 'details' && (
          <div className="space-y-6">
            <CommonFields
              value={common}
              onChange={setCommon}
              vendors={vendors}
              locations={locations}
              departments={departments}
              employees={employees}
              statuses={statuses}
            />
            <div className="border-t border-slate-200 pt-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Type-Specific Details</div>
              {renderExtraFields(extra, setExtra, common)}
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div>
            {historyLoading && (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-brand-600" /></div>
            )}
            {!historyLoading && history.length === 0 && (
              <div className="text-center text-sm text-slate-400 py-12">No assignment history.</div>
            )}
            {!historyLoading && history.length > 0 && (
              <div className="space-y-3">
                {history.map((h) => (
                  <div key={h.id} className="card p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-slate-900">{h.employee_name}</div>
                        {h.employee_code && <div className="text-xs text-slate-500">{h.employee_code}</div>}
                      </div>
                      {!h.returned_date && (
                        <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">Current</span>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {new Date(h.assigned_date).toLocaleDateString('en-GB')}
                      {' → '}
                      {h.returned_date ? new Date(h.returned_date).toLocaleDateString('en-GB') : 'Present'}
                    </div>
                    {h.assigned_by_username && (
                      <div className="text-xs text-slate-400 mt-1">by {h.assigned_by_username}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
