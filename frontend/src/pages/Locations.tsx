import { useCallback, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/table/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { locationsApi } from '../api/lookups';
import type { Location } from '../types/api';

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

export default function LocationsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState<{ name: string; type: Location['type']; country: string; address: string }>({
    name: '', type: 'office', country: '', address: '',
  });
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const fetcher = useCallback((p: any) => locationsApi.list(p), [reloadKey]);

  const openNew = () => { setEditing(null); setForm({ name: '', type: 'office', country: '', address: '' }); setOpen(true); };
  const openEdit = (row: Location) => {
    setEditing(row);
    setForm({ name: row.name, type: row.type, country: row.country || '', address: row.address || '' });
    setOpen(true);
  };

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
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Location['type'] })}>
              <option value="office">Office</option>
              <option value="datacenter">Data Centre</option>
              <option value="other">Other</option>
            </select>
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
      </Drawer>
    </>
  );
}
