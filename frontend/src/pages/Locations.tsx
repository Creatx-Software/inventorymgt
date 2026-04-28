import { useCallback, useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/table/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { locationsApi } from '../api/lookups';
import { api } from '../api/client';
import type { Location } from '../types/api';
import { Users, Package, PackageOpen, Loader2 } from 'lucide-react';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import {
  RelatedAssetGroups, RelatedEmployeeList, RelatedConsumableList, CountBadge,
  type RelatedAssetGroup, type RelatedEmployee, type RelatedConsumable,
} from '../components/related/RelatedPanels';

const typeBadge: Record<Location['type'], string> = {
  office: 'bg-blue-50 text-blue-700 border-blue-200',
  datacenter: 'bg-purple-50 text-purple-700 border-purple-200',
  other: 'bg-slate-50 text-slate-700 border-slate-200',
};

const columns: ColumnDef<Location, any>[] = [
  { accessorKey: 'id', header: 'ID', size: 70 },
  { accessorKey: 'name', header: 'Name', size: 260 },
  {
    accessorKey: 'type', header: 'Type', size: 130,
    cell: (i) => {
      const v = i.getValue() as Location['type'];
      return <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${typeBadge[v]}`}>{v}</span>;
    },
  },
  { accessorKey: 'country', header: 'Country', size: 140, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'address', header: 'Address', size: 320, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
];

interface RelatedData {
  employees: RelatedEmployee[];
  employeesCount: number;
  groups: RelatedAssetGroup[];
  totalCount: number;
  consumables: RelatedConsumable[];
  consumablesCount: number;
}

type Tab = 'details' | 'employees' | 'assets' | 'consumables';

export default function LocationsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState<{ name: string; type: Location['type']; country: string; address: string }>({
    name: '', type: 'office', country: '', address: '',
  });
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>('details');
  const [related, setRelated] = useState<RelatedData | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const fetcher = useCallback((p: any) => locationsApi.list(p), [reloadKey]);

  const openNew = () => {
    setEditing(null); setRelated(null); setTab('details');
    setForm({ name: '', type: 'office', country: '', address: '' });
    setOpen(true);
  };
  const openEdit = (row: Location) => {
    setEditing(row); setRelated(null); setTab('details');
    setForm({ name: row.name, type: row.type, country: row.country || '', address: row.address || '' });
    setOpen(true);
  };

  useEffect(() => {
    if (!editing || tab === 'details' || related) return;
    setRelatedLoading(true);
    api.get(`/locations/${editing.id}/related`)
      .then((r) => setRelated(r.data))
      .finally(() => setRelatedLoading(false));
  }, [tab, editing, related]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { name: form.name, type: form.type, country: form.country || null, address: form.address || null };
      if (editing) await locationsApi.update(editing.id, payload as any);
      else await locationsApi.create(payload as any);
      setOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!editing || !confirm(`Delete "${editing.name}"?`)) return;
    await locationsApi.remove(editing.id);
    setOpen(false);
    setReloadKey((k) => k + 1);
  };

  return (
    <>
      <DataTable<Location>
        title="Locations"
        subtitle="Offices and data centres"
        columns={columns}
        fetcher={fetcher}
        onCreate={openNew}
        onRowClick={openEdit}
        onBulkDelete={async (ids) => { await locationsApi.bulkDelete(ids); setReloadKey((k) => k + 1); }}
        onRestore={async (id) => { await locationsApi.restore(id); setReloadKey((k) => k + 1); }}
        stickyColumnIds={['name']}
        viewKey="locations"
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Location' : 'New Location'}
        subtitle={editing ? `ID #${editing.id}` : 'Add a new location'}
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
          <div className="flex gap-1 mb-5 border-b border-slate-200 -mx-6 px-6 overflow-x-auto">
            <TabButton active={tab === 'details'} onClick={() => setTab('details')} label="Details" />
            <TabButton active={tab === 'employees'} onClick={() => setTab('employees')}
              label="Employees" icon={Users} count={related?.employeesCount} />
            <TabButton active={tab === 'assets'} onClick={() => setTab('assets')}
              label="Assets" icon={Package} count={related?.totalCount} />
            <TabButton active={tab === 'consumables'} onClick={() => setTab('consumables')}
              label="Consumables" icon={PackageOpen} count={related?.consumablesCount} />
          </div>
        )}

        {tab === 'details' && (
          <div className="space-y-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="label">Type</label>
              <SearchableSelect
                value={form.type}
                onChange={(v) => setForm({ ...form, type: (v || 'office') as Location['type'] })}
                options={[
                  { value: 'office', label: 'Office' },
                  { value: 'datacenter', label: 'Data Centre' },
                  { value: 'other', label: 'Other' },
                ]}
                emptyOption={null}
              />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
            <div>
              <label className="label">Address</label>
              <textarea className="input min-h-[80px]" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
        {tab === 'consumables' && !relatedLoading && related && (
          <RelatedConsumableList consumables={related.consumables} onClose={() => setOpen(false)} />
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
      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-1.5 whitespace-nowrap ${
        active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
      {typeof count === 'number' && <CountBadge value={count} />}
    </button>
  );
}
