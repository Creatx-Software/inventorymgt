import { useCallback, useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/table/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { departmentsApi } from '../api/lookups';
import { api } from '../api/client';
import type { Department } from '../types/api';
import { Users, Package, Loader2 } from 'lucide-react';
import {
  RelatedAssetGroups, RelatedEmployeeList, CountBadge,
  type RelatedAssetGroup, type RelatedEmployee,
} from '../components/related/RelatedPanels';

const columns: ColumnDef<Department, any>[] = [
  { accessorKey: 'id', header: 'ID', size: 70 },
  { accessorKey: 'name', header: 'Name', size: 240 },
  { accessorKey: 'description', header: 'Description', size: 360, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'created_at', header: 'Created', size: 160, cell: (i) => new Date(i.getValue()).toLocaleDateString('en-GB') },
];

interface RelatedData {
  employees: RelatedEmployee[];
  employeesCount: number;
  groups: RelatedAssetGroup[];
  totalCount: number;
}

type Tab = 'details' | 'employees' | 'assets';

export default function DepartmentsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>('details');
  const [related, setRelated] = useState<RelatedData | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const fetcher = useCallback((p: any) => departmentsApi.list(p), [reloadKey]);

  const openNew = () => {
    setEditing(null); setRelated(null); setTab('details');
    setForm({ name: '', description: '' });
    setOpen(true);
  };
  const openEdit = (row: Department) => {
    setEditing(row); setRelated(null); setTab('details');
    setForm({ name: row.name, description: row.description || '' });
    setOpen(true);
  };

  useEffect(() => {
    if (!editing || tab === 'details' || related) return;
    setRelatedLoading(true);
    api.get(`/departments/${editing.id}/related`)
      .then((r) => setRelated(r.data))
      .finally(() => setRelatedLoading(false));
  }, [tab, editing, related]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { name: form.name, description: form.description || null };
      if (editing) await departmentsApi.update(editing.id, payload as any);
      else await departmentsApi.create(payload as any);
      setOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!editing || !confirm(`Delete "${editing.name}"?`)) return;
    await departmentsApi.remove(editing.id);
    setOpen(false);
    setReloadKey((k) => k + 1);
  };

  return (
    <>
      <DataTable<Department>
        title="Departments"
        subtitle="Organisational units"
        columns={columns}
        fetcher={fetcher}
        onCreate={openNew}
        onRowClick={openEdit}
        onBulkDelete={async (ids) => { await departmentsApi.bulkDelete(ids); setReloadKey((k) => k + 1); }}
        onRestore={async (id) => { await departmentsApi.restore(id); setReloadKey((k) => k + 1); }}
        stickyColumnIds={['name']}
        viewKey="departments"
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Department' : 'New Department'}
        subtitle={editing ? `ID #${editing.id}` : 'Add a new department'}
        width="lg"
        footer={
          <div className="flex justify-between">
            <div>{editing && <button onClick={remove} className="btn bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">Delete</button>}</div>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving || !form.name} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        }
      >
        {editing && (
          <div className="flex gap-1 mb-5 border-b border-slate-200 -mx-6 px-6">
            <TabButton active={tab === 'details'} onClick={() => setTab('details')} label="Details" />
            <TabButton active={tab === 'employees'} onClick={() => setTab('employees')}
              label="Employees" icon={Users} count={related?.employeesCount} />
            <TabButton active={tab === 'assets'} onClick={() => setTab('assets')}
              label="Assets" icon={Package} count={related?.totalCount} />
          </div>
        )}

        {tab === 'details' && (
          <div className="space-y-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input min-h-[100px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
        )}

        {tab !== 'details' && relatedLoading && (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-brand-600" /></div>
        )}
        {tab === 'employees' && !relatedLoading && related && (
          <RelatedEmployeeList employees={related.employees} onClose={() => setOpen(false)} />
        )}
        {tab === 'assets' && !relatedLoading && related && (
          <RelatedAssetGroups groups={related.groups} totalCount={related.totalCount} onClose={() => setOpen(false)} />
        )}
      </Drawer>
    </>
  );
}

function TabButton({
  active, onClick, label, icon: Icon, count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ElementType;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-1.5 ${
        active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
      {typeof count === 'number' && <CountBadge value={count} />}
    </button>
  );
}
