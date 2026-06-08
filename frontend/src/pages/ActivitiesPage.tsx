import { useCallback, useEffect, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Paperclip, Download, Upload } from 'lucide-react';
import { DataTable } from '../components/table/DataTable';
import type { FilterFieldDef } from '../components/table/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { ImportModal } from '../components/import/ImportModal';
import { activitiesApi, type Activity } from '../api/activities';
import { employeesApi } from '../api/lookups';
import { fmtDate } from '../components/asset/CommonFields';
import { useAuth } from '../contexts/AuthContext';
import type { Employee, ListParams } from '../types/api';

// Columns defined outside so they are stable references
const columns: ColumnDef<Activity, any>[] = [
  {
    accessorKey: 'date',
    header: 'Date',
    size: 110,
    cell: (i) => <span className="font-medium text-brand-600">{fmtDate(i.getValue() as string)}</span>,
  },
  {
    accessorKey: 'sub_category',
    header: 'Sub Category',
    size: 150,
    cell: (i) => i.getValue() || <span className="text-slate-300">—</span>,
  },
  {
    accessorKey: 'ip_address',
    header: 'IP Address',
    size: 140,
    cell: (i) => i.getValue()
      ? <span className="font-mono text-xs">{i.getValue() as string}</span>
      : <span className="text-slate-300">—</span>,
  },
  {
    accessorKey: 'device',
    header: 'Device',
    size: 160,
    cell: (i) => i.getValue() || <span className="text-slate-300">—</span>,
  },
  {
    accessorKey: 'sn_call_number',
    header: 'SN / Call No.',
    size: 140,
    cell: (i) => i.getValue() || <span className="text-slate-300">—</span>,
  },
  {
    accessorKey: 'raised_by_name',
    header: 'Raised By',
    size: 150,
    cell: (i) => i.getValue() || <span className="text-slate-300">—</span>,
  },
  {
    accessorKey: 'description',
    header: 'Description',
    size: 300,
    cell: (i) => (
      <span className="line-clamp-1 text-slate-600">
        {i.getValue() || <span className="text-slate-300">—</span>}
      </span>
    ),
  },
  {
    id: 'email_attachment',
    header: 'Email Attached',
    size: 200,
    cell: ({ row }) => {
      const r = row.original;
      if (!r.has_attachment) return <span className="text-slate-300">—</span>;
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            activitiesApi.downloadAttachment(r.id, r.email_attachment_name ?? 'attachment.msg');
          }}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-medium max-w-[180px]"
          title={`Download ${r.email_attachment_name}`}
        >
          <Paperclip className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{r.email_attachment_name}</span>
          <Download className="w-3 h-3 shrink-0" />
        </button>
      );
    },
  },
  {
    accessorKey: 'created_by_name',
    header: 'Logged By',
    size: 130,
    cell: (i) => <span className="text-slate-500 text-xs">{i.getValue() as string}</span>,
  },
];

const filterFields: FilterFieldDef[] = [
  { key: 'sub_category', label: 'Sub Category', type: 'text', placeholder: 'e.g. Network' },
  { key: 'ip_address',   label: 'IP Address',   type: 'text', placeholder: '192.168.x.x' },
  { key: 'device',       label: 'Device',        type: 'text', placeholder: 'Server, Switch…' },
  { key: 'sn_call_number', label: 'SN / Call No.', type: 'text' },
];

interface FormState {
  date: string;
  sub_category: string;
  ip_address: string;
  device: string;
  sn_call_number: string;
  raised_by_employee_id: string;
  description: string;
}

const EMPTY: FormState = {
  date: '', sub_category: '', ip_address: '',
  device: '', sn_call_number: '', raised_by_employee_id: '', description: '',
};

export default function ActivitiesPage() {
  const { user, isSuperAdmin } = useAuth();
  const [open, setOpen]         = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing]   = useState<Activity | null>(null);
  const [form, setForm]         = useState<FormState>(EMPTY);
  const [file, setFile]         = useState<File | null>(null);
  const [removeAttach, setRemoveAttach] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    employeesApi.list({ pageSize: 1000, filters: { is_active: '1' } })
      .then((r) => setEmployees(r.data))
      .catch(() => {});
  }, []);

  const fetcher = useCallback(
    (p: ListParams) => activitiesApi.list(p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reloadKey],
  );

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, date: today });
    setFile(null);
    setRemoveAttach(false);
    setOpen(true);
  };

  const openEdit = (r: Activity) => {
    setEditing(r);
    setForm({
      date:          r.date,
      sub_category:  r.sub_category  ?? '',
      ip_address:    r.ip_address    ?? '',
      device:        r.device        ?? '',
      sn_call_number: r.sn_call_number ?? '',
      raised_by_employee_id: r.raised_by_employee_id ? String(r.raised_by_employee_id) : '',
      description:   r.description   ?? '',
    });
    setFile(null);
    setRemoveAttach(false);
    setOpen(true);
  };

  const closeDrawer = () => { setOpen(false); setEditing(null); setFile(null); };

  const f = <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const save = async () => {
    if (!form.date) { alert('Date is required'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      (Object.entries(form) as [string, string][]).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('email_attachment', file);
      if (editing && removeAttach && !file) fd.append('remove_attachment', '1');

      if (editing) await activitiesApi.update(editing.id, fd);
      else         await activitiesApi.create(fd);

      setReloadKey((k) => k + 1);
      closeDrawer();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing || !confirm('Delete this activity?')) return;
    await activitiesApi.remove(editing.id);
    setReloadKey((k) => k + 1);
    closeDrawer();
  };

  const canDelete = editing
    ? isSuperAdmin() || editing.created_by_user_id === user?.id
    : false;

  const hasAttachment = !!(editing?.has_attachment);
  const showExistingAttachment = hasAttachment && !removeAttach && !file;

  const employeeOptions = employees.map((e) => ({
    value: String(e.id),
    label: e.full_name,
    sublabel: e.employee_code ?? undefined,
  }));

  return (
    <>
      <DataTable<Activity>
        title="Activities"
        subtitle="Activity log with email attachments"
        columns={columns}
        fetcher={fetcher}
        onCreate={openNew}
        onRowClick={openEdit}
        onBulkDelete={async (ids) => {
          await activitiesApi.bulkDelete(ids);
          setReloadKey((k) => k + 1);
        }}
        viewKey="activities"
        defaultSorting={[{ id: 'date', desc: true }]}
        filterFields={filterFields}
        extraActions={
          <button onClick={() => setImportOpen(true)} className="btn-secondary">
            <Upload className="w-4 h-4" /> Import
          </button>
        }
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        assetType="activities"
        title="Activities"
        onSuccess={() => setReloadKey((k) => k + 1)}
      />

      <Drawer
        open={open}
        onClose={closeDrawer}
        title={editing ? 'Edit Activity' : 'New Activity'}
        subtitle={editing ? `ID #${editing.id}` : 'Log a new activity'}
        width="lg"
        footer={
          <div className="flex justify-between">
            <div>
              {canDelete && (
                <button onClick={remove} className="btn bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={closeDrawer} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date <span className="text-red-500">*</span></label>
              <input type="date" className="input" value={form.date} onChange={f('date')} />
            </div>
            <div>
              <label className="label">Sub Category</label>
              <input className="input" value={form.sub_category} onChange={f('sub_category')} placeholder="e.g. Network, Hardware" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">IP Address</label>
              <input className="input font-mono" value={form.ip_address} onChange={f('ip_address')} placeholder="192.168.1.1" />
            </div>
            <div>
              <label className="label">Device</label>
              <input className="input" value={form.device} onChange={f('device')} placeholder="Server / Switch / etc." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">SN / Call Number</label>
              <input className="input" value={form.sn_call_number} onChange={f('sn_call_number')} placeholder="Ticket or serial no." />
            </div>
            <div>
              <label className="label">Raised By</label>
              <SearchableSelect
                value={form.raised_by_employee_id}
                onChange={(v) => setForm((prev) => ({ ...prev, raised_by_employee_id: v }))}
                options={employeeOptions}
                placeholder="Search employee…"
                emptyOption="— None —"
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[90px]"
              value={form.description}
              onChange={f('description')}
              placeholder="Describe the activity…"
            />
          </div>

          {/* Email Attachment */}
          <div>
            <label className="label">
              Email Attached <span className="text-slate-400 font-normal text-xs">(.msg files only)</span>
            </label>

            {showExistingAttachment && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg mb-2">
                <Paperclip className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="text-xs text-blue-700 truncate flex-1">{editing?.email_attachment_name}</span>
                <button
                  onClick={() => setRemoveAttach(true)}
                  className="text-xs text-red-500 hover:text-red-700 shrink-0"
                >
                  Remove
                </button>
              </div>
            )}

            {removeAttach && !file && (
              <p className="text-xs text-slate-500 mb-2">
                Attachment will be removed on save.{' '}
                <button onClick={() => setRemoveAttach(false)} className="text-brand-600 hover:underline">Undo</button>
              </p>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".msg"
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  if (picked && !picked.name.toLowerCase().endsWith('.msg')) {
                    alert('Only .msg files are allowed');
                    e.target.value = '';
                    return;
                  }
                  setFile(picked);
                  if (picked) setRemoveAttach(false);
                }}
                className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
              />
              {file && (
                <button
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="shrink-0 text-xs text-slate-400 hover:text-slate-600 underline whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
            {file && <p className="text-xs text-slate-500 mt-1">Selected: {file.name}</p>}
          </div>
        </div>
      </Drawer>
    </>
  );
}
