import { useCallback, useEffect, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Paperclip, Download, Upload } from 'lucide-react';
import { DataTable } from '../components/table/DataTable';
import type { FilterFieldDef } from '../components/table/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { ImportModal } from '../components/import/ImportModal';
import { incidentsApi, type Incident } from '../api/operations';
import { employeesApi } from '../api/lookups';
import { fmtDate } from '../components/asset/CommonFields';
import type { Employee, ListParams } from '../types/api';

const fmtTime = (dt: string | null) => {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const columns: ColumnDef<Incident, any>[] = [
  {
    accessorKey: 'date',
    header: 'Date',
    size: 110,
    cell: (i) => i.getValue()
      ? <span className="font-medium text-brand-600">{fmtDate(i.getValue() as string)}</span>
      : <span className="text-slate-300">—</span>,
  },
  {
    accessorKey: 'start_datetime',
    header: 'Start Time',
    size: 110,
    cell: (i) => <span className="font-mono text-xs">{fmtTime(i.getValue() as string)}</span>,
  },
  {
    accessorKey: 'end_datetime',
    header: 'End Time',
    size: 110,
    cell: (i) => <span className="font-mono text-xs">{fmtTime(i.getValue() as string)}</span>,
  },
  {
    accessorKey: 'incident_code',
    header: 'Incident Number',
    size: 160,
    cell: (i) => i.getValue() || <span className="text-slate-300">—</span>,
  },
  {
    accessorKey: 'application_impacted',
    header: 'Application Name',
    size: 180,
    cell: (i) => i.getValue() || <span className="text-slate-300">—</span>,
  },
  {
    accessorKey: 'problem_statement',
    header: 'Description',
    size: 280,
    cell: (i) => (
      <span className="line-clamp-1 text-slate-600">
        {i.getValue() || <span className="text-slate-300">—</span>}
      </span>
    ),
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
            incidentsApi.downloadAttachment(r.id, r.email_attachment_name ?? 'attachment.msg');
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
];

const filterFields: FilterFieldDef[] = [
  { key: 'incident_code',        label: 'Incident Number', type: 'text' },
  { key: 'application_impacted', label: 'Application Name', type: 'text' },
  { key: 'sn_call_number',       label: 'SN / Call No.',   type: 'text' },
];

interface FormState {
  date: string;
  start_time: string;
  end_time: string;
  incident_code: string;
  application_impacted: string;
  problem_statement: string;
  sn_call_number: string;
  raised_by_employee_id: string;
}

const EMPTY: FormState = {
  date: '', start_time: '', end_time: '',
  incident_code: '', application_impacted: '',
  problem_statement: '', sn_call_number: '',
  raised_by_employee_id: '',
};

const toDateStr = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const toTimeStr = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const combineDatetime = (date: string, time: string): string | null => {
  if (!date) return null;
  const t = time || '00:00';
  return `${date}T${t}:00`;
};

export default function IncidentsPage() {
  const [open, setOpen]           = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing]     = useState<Incident | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY);
  const [file, setFile]           = useState<File | null>(null);
  const [removeAttach, setRemoveAttach] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().slice(0, 10);

  const fetcher = useCallback(
    (p: ListParams) => incidentsApi.list(p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reloadKey],
  );

  useEffect(() => {
    employeesApi.list({ pageSize: 1000, filters: { is_active: '1' } })
      .then((r) => setEmployees(r.data))
      .catch(() => {});
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, date: today });
    setFile(null);
    setRemoveAttach(false);
    setOpen(true);
  };

  const openEdit = (r: Incident) => {
    setEditing(r);
    setForm({
      date:                  toDateStr(r.date ?? r.start_datetime),
      start_time:            toTimeStr(r.start_datetime),
      end_time:              toTimeStr(r.end_datetime),
      incident_code:         r.incident_code         ?? '',
      application_impacted:  r.application_impacted  ?? '',
      problem_statement:     r.problem_statement      ?? '',
      sn_call_number:        r.sn_call_number         ?? '',
      raised_by_employee_id: r.raised_by_employee_id ? String(r.raised_by_employee_id) : '',
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
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('date',                 form.date);
      fd.append('start_datetime',       combineDatetime(form.date, form.start_time) ?? '');
      fd.append('end_datetime',         combineDatetime(form.date, form.end_time)   ?? '');
      fd.append('incident_code',        form.incident_code);
      fd.append('application_impacted', form.application_impacted);
      fd.append('problem_statement',    form.problem_statement);
      fd.append('sn_call_number',       form.sn_call_number);
      fd.append('raised_by_employee_id', form.raised_by_employee_id);
      if (file) fd.append('email_attachment', file);
      if (editing && removeAttach && !file) fd.append('remove_attachment', '1');

      if (editing) await incidentsApi.update(editing.id, fd);
      else         await incidentsApi.create(fd);

      setReloadKey((k) => k + 1);
      closeDrawer();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing || !confirm('Delete this incident?')) return;
    await incidentsApi.remove(editing.id);
    setReloadKey((k) => k + 1);
    closeDrawer();
  };

  const hasAttachment = !!(editing?.has_attachment);
  const showExistingAttachment = hasAttachment && !removeAttach && !file;

  const employeeOptions = employees.map((e) => ({
    value: String(e.id),
    label: e.full_name,
    sublabel: e.employee_code ?? undefined,
  }));

  return (
    <>
      <DataTable<Incident>
        title="Incidents"
        subtitle="Incident log with email attachments"
        columns={columns}
        fetcher={fetcher}
        onCreate={openNew}
        onRowClick={openEdit}
        onBulkDelete={async (ids) => {
          await incidentsApi.bulkDelete(ids);
          setReloadKey((k) => k + 1);
        }}
        viewKey="incidents"
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
        assetType="incidents"
        title="Incidents"
        onSuccess={() => setReloadKey((k) => k + 1)}
      />

      <Drawer
        open={open}
        onClose={closeDrawer}
        title={editing ? 'Edit Incident' : 'New Incident'}
        subtitle={editing ? `ID #${editing.id}` : 'Log a new incident'}
        width="lg"
        footer={
          <div className="flex justify-between">
            <div>
              {editing && (
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
          {/* Row 1: Date, Incident Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} onChange={f('date')} />
            </div>
            <div>
              <label className="label">Incident Number</label>
              <input className="input" value={form.incident_code} onChange={f('incident_code')} placeholder="INC-2024-001" />
            </div>
          </div>

          {/* Row 2: Start Time, End Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Time</label>
              <input type="time" className="input" value={form.start_time} onChange={f('start_time')} />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className="input" value={form.end_time} onChange={f('end_time')} />
            </div>
          </div>

          {/* Row 3: Application Name, SN / Call Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Application Name</label>
              <input className="input" value={form.application_impacted} onChange={f('application_impacted')} placeholder="e.g. Core Banking" />
            </div>
            <div>
              <label className="label">SN / Call Number</label>
              <input className="input" value={form.sn_call_number} onChange={f('sn_call_number')} placeholder="Ticket or serial no." />
            </div>
          </div>

          {/* Row 4: Raised By */}
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

          {/* Row 5: Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[90px]"
              value={form.problem_statement}
              onChange={f('problem_statement')}
              placeholder="Describe the incident…"
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
