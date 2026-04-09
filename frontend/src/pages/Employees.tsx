import { useCallback, useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/table/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { employeesApi, departmentsApi, locationsApi } from '../api/lookups';
import type { Employee, Department, Location } from '../types/api';
import { AlertCircle } from 'lucide-react';

export default function EmployeesPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({
    employee_code: '', full_name: '', email: '', department_id: '', location_id: '', is_active: true,
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const fetcher = useCallback((p: any) => employeesApi.list(p), [reloadKey]);

  useEffect(() => {
    departmentsApi.list({ pageSize: 500 }).then((r) => setDepartments(r.data)).catch(() => {});
    locationsApi.list({ pageSize: 500 }).then((r) => setLocations(r.data)).catch(() => {});
  }, []);

  const deptName = (id: number | null) => departments.find((d) => d.id === id)?.name || '—';
  const locName = (id: number | null) => locations.find((l) => l.id === id)?.name || '—';

  const columns: ColumnDef<Employee, any>[] = [
    { accessorKey: 'id', header: 'ID', size: 70 },
    { accessorKey: 'employee_code', header: 'Code', size: 140, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
    {
      accessorKey: 'full_name', header: 'Full Name', size: 240,
      cell: (i) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{i.getValue() as string}</span>
          {i.row.original.needs_review && (
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
    setForm({ employee_code: '', full_name: '', email: '', department_id: '', location_id: '', is_active: true });
    setOpen(true);
  };

  const openEdit = (row: Employee) => {
    setEditing(row);
    setForm({
      employee_code: row.employee_code || '',
      full_name: row.full_name,
      email: row.email || '',
      department_id: row.department_id ? String(row.department_id) : '',
      location_id: row.location_id ? String(row.location_id) : '',
      is_active: row.is_active,
    });
    setOpen(true);
  };

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
        stickyColumnIds={['full_name']}
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Employee' : 'New Employee'}
        subtitle={editing ? `ID #${editing.id}` : 'Add a new employee'}
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
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <label className="label">Employee Code</label>
            <input className="input" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />
          </div>
          <div className="col-span-1">
            <label className="label">Full Name *</label>
            <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus />
          </div>
          <div className="col-span-2">
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="col-span-1">
            <label className="label">Department</label>
            <select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">— None —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="col-span-1">
            <label className="label">Location</label>
            <select className="input" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })}>
              <option value="">— None —</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
          </div>
        </div>
      </Drawer>
    </>
  );
}
