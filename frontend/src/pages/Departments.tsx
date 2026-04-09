import { useCallback, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/table/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { departmentsApi } from '../api/lookups';
import type { Department } from '../types/api';

const columns: ColumnDef<Department, any>[] = [
  { accessorKey: 'id', header: 'ID', size: 70 },
  { accessorKey: 'name', header: 'Name', size: 240 },
  { accessorKey: 'description', header: 'Description', size: 360, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'created_at', header: 'Created', size: 160, cell: (i) => new Date(i.getValue()).toLocaleDateString('en-GB') },
];

export default function DepartmentsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const fetcher = useCallback((p: any) => departmentsApi.list(p), [reloadKey]);

  const openNew = () => { setEditing(null); setForm({ name: '', description: '' }); setOpen(true); };
  const openEdit = (row: Department) => {
    setEditing(row);
    setForm({ name: row.name, description: row.description || '' });
    setOpen(true);
  };

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
        stickyColumnIds={['name']}
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Department' : 'New Department'}
        subtitle={editing ? `ID #${editing.id}` : 'Add a new department'}
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
            <label className="label">Description</label>
            <textarea className="input min-h-[100px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
      </Drawer>
    </>
  );
}
