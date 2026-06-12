import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import clsx from 'clsx';
import { DataTable } from '../components/table/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { IpInput, IpPills } from '../components/firewall/IpInput';
import { firewallsApi, type FirewallRule, type ExpireBucket } from '../api/firewalls';
import { employeesApi } from '../api/lookups';
import type { Employee, ListParams } from '../types/api';
import { Calendar, Clock, AlertCircle, Upload } from 'lucide-react';
import { ImportModal } from '../components/import/ImportModal';

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

function ruleTypeBadge(type: 'Temp' | 'Permanent') {
  return (
    <span className={clsx(
      'px-2 py-0.5 text-[11px] font-medium rounded-full border',
      type === 'Permanent'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-amber-50 text-amber-700 border-amber-200',
    )}>{type}</span>
  );
}

function directionBadge(dir: 'Bi-Directional' | 'Uni-Directional') {
  return (
    <span className={clsx(
      'px-2 py-0.5 text-[11px] font-medium rounded-full border',
      dir === 'Bi-Directional'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-slate-50 text-slate-700 border-slate-200',
    )}>{dir === 'Bi-Directional' ? 'Bi' : 'Uni'}</span>
  );
}

function ExpireCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-300">—</span>;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(value); d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  const expired = diff < 0;
  const soon = diff >= 0 && diff <= 30;
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-xs',
      expired ? 'text-red-600 font-medium' : soon ? 'text-amber-600' : 'text-slate-700',
    )}>
      <Calendar className="w-3 h-3" />
      {fmtDate(value)}
      {expired && <span className="text-red-500">(expired)</span>}
      {!expired && soon && <span className="text-amber-500">in {diff}d</span>}
    </span>
  );
}

interface FormState {
  application_name: string;
  sources: string[];
  source_nats: string[];
  destinations: string[];
  destination_nats: string[];
  ports: string;
  protocol: 'TCP' | 'UDP' | 'TCP/UDP';
  direction: 'Bi-Directional' | 'Uni-Directional';
  rule_type: 'Temp' | 'Permanent';
  expire_date: string;
  days_window: string;
  time_window: string;
  sn_call_number: string;
  engineer_requested_employee_id: string;
  request_date: string;
  description: string;
}

const empty: FormState = {
  application_name: '', sources: [], source_nats: [], destinations: [], destination_nats: [],
  ports: '', protocol: 'TCP', direction: 'Uni-Directional', rule_type: 'Permanent',
  expire_date: '', days_window: '', time_window: '',
  sn_call_number: '', engineer_requested_employee_id: '', request_date: '', description: '',
};

const EXPIRE_BUCKETS: { value: ExpireBucket | ''; label: string }[] = [
  { value: '',        label: 'All' },
  { value: 'expired', label: 'Expired' },
  { value: '1d',      label: '1 day' },
  { value: '1w',      label: '1 week' },
  { value: '2w',      label: '2 weeks' },
  { value: '1m',      label: '1 month' },
  { value: '3m',      label: '3 months' },
];

export default function FirewallsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FirewallRule | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expireBucket, setExpireBucket] = useState<ExpireBucket | ''>('');
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    employeesApi.list({ pageSize: 1000 }).then((r) => setEmployees(r.data)).catch(() => {});
  }, []);

  const fetcher = useCallback((p: ListParams) =>
    firewallsApi.list({ ...p, expire_within: expireBucket || undefined }),
    [reloadKey, expireBucket]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, request_date: new Date().toISOString().slice(0, 10) });
    setOpen(true);
  };

  const openEdit = (row: FirewallRule) => {
    setEditing(row);
    setForm({
      application_name: row.application_name,
      sources: row.sources || [],
      source_nats: row.source_nats || [],
      destinations: row.destinations || [],
      destination_nats: row.destination_nats || [],
      ports: row.ports || '',
      protocol: row.protocol,
      direction: row.direction,
      rule_type: row.rule_type,
      expire_date: row.expire_date ? row.expire_date.slice(0, 10) : '',
      days_window: row.days_window || '',
      time_window: row.time_window || '',
      sn_call_number: row.sn_call_number || '',
      engineer_requested_employee_id: row.engineer_requested_employee_id ? String(row.engineer_requested_employee_id) : '',
      request_date: row.request_date ? row.request_date.slice(0, 10) : '',
      description: row.description || '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.application_name.trim()) { alert('Application name is required'); return; }
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        engineer_requested_employee_id: form.engineer_requested_employee_id ? Number(form.engineer_requested_employee_id) : null,
        expire_date: form.rule_type === 'Temp' ? form.expire_date || null : null,
      };
      if (editing) await firewallsApi.update(editing.id, payload);
      else await firewallsApi.create(payload);
      setOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!editing || !confirm(`Delete rule "${editing.application_name}"?`)) return;
    await firewallsApi.remove(editing.id);
    setOpen(false);
    setReloadKey((k) => k + 1);
  };

  const columns = useMemo<ColumnDef<FirewallRule, any>[]>(() => [
    { accessorKey: 'application_name', header: 'Application', size: 180,
      cell: (i) => <span className="font-medium text-slate-900">{i.getValue() as string}</span> },
    { accessorKey: 'sources', header: 'Source', size: 220, enableSorting: false, cell: (i) => <IpPills ips={i.row.original.sources} /> },
    { accessorKey: 'source_nats', header: 'Source Nat', size: 220, enableSorting: false, cell: (i) => <IpPills ips={i.row.original.source_nats} /> },
    { accessorKey: 'destinations', header: 'Destination', size: 220, enableSorting: false, cell: (i) => <IpPills ips={i.row.original.destinations} /> },
    { accessorKey: 'destination_nats', header: 'Destination Nat', size: 220, enableSorting: false, cell: (i) => <IpPills ips={i.row.original.destination_nats} /> },
    { accessorKey: 'ports', header: 'Ports', size: 120, cell: (i) =>
        i.getValue() ? <span className="font-mono text-xs">{i.getValue() as string}</span> : <span className="text-slate-300">—</span> },
    { accessorKey: 'protocol', header: 'Protocol', size: 100, cell: (i) =>
        <span className="font-mono text-xs">{i.getValue() as string}</span> },
    { accessorKey: 'direction', header: 'Direction', size: 110, cell: (i) => directionBadge(i.getValue() as any) },
    { accessorKey: 'rule_type', header: 'Type', size: 110, cell: (i) => ruleTypeBadge(i.getValue() as any) },
    { accessorKey: 'expire_date', header: 'Expire Date', size: 150, cell: (i) => <ExpireCell value={i.getValue() as string | null} /> },
    { accessorKey: 'days_window', header: 'Days Window', size: 130,
      cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
    { accessorKey: 'time_window', header: 'Time Window', size: 130,
      cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
    { accessorKey: 'sn_call_number', header: 'SN Call #', size: 140, cell: (i) =>
        i.getValue() ? <span className="font-mono text-xs">{i.getValue() as string}</span> : <span className="text-slate-300">—</span> },
    { accessorKey: 'engineer_name', header: 'Engineer', size: 180, cell: (i) => {
        const r = i.row.original;
        if (!r.engineer_name) return <span className="text-slate-300">—</span>;
        return <span>{r.engineer_name}{r.engineer_code ? <span className="text-slate-400 text-xs ml-1">({r.engineer_code})</span> : ''}</span>;
      },
    },
    { accessorKey: 'request_date', header: 'Date', size: 120, cell: (i) => fmtDate(i.getValue() as string | null) },
    { accessorKey: 'description', header: 'Description', size: 240,
      cell: (i) => i.getValue() ? <span className="line-clamp-1">{i.getValue() as string}</span> : <span className="text-slate-300">—</span> },
  ], []);

  return (
    <div className="space-y-3">
      {/* Expire bucket filter */}
      <div className="card p-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 shrink-0">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          Expires within
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EXPIRE_BUCKETS.map((b) => (
            <button
              key={b.value || 'all'}
              onClick={() => setExpireBucket(b.value)}
              className={clsx(
                'px-3 py-1 rounded-lg text-xs font-medium transition border',
                expireBucket === b.value
                  ? b.value === 'expired'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              {b.value === 'expired' && <AlertCircle className="w-3 h-3 inline mr-1" />}
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable<FirewallRule>
        title="Firewall Rules"
        subtitle="Network firewall rules and exceptions"
        columns={columns}
        fetcher={fetcher}
        onCreate={openNew}
        onRowClick={openEdit}
        onBulkDelete={async (ids) => { await firewallsApi.bulkDelete(ids); setReloadKey((k) => k + 1); }}
        onRestore={async (id) => { await firewallsApi.restore(id); setReloadKey((k) => k + 1); }}
        stickyColumnIds={['application_name']}
        viewKey="firewalls"
        extraActions={
          <button onClick={() => setImportOpen(true)} className="btn-secondary">
            <Upload className="w-4 h-4" /> Import
          </button>
        }
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        assetType="firewall"
        title="Firewall Rules"
        onSuccess={() => setReloadKey((k) => k + 1)}
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Firewall Rule' : 'New Firewall Rule'}
        subtitle={editing ? `ID #${editing.id}` : 'Define a new rule'}
        width="lg"
        footer={
          <div className="flex justify-between">
            <div>{editing && (
              <button onClick={remove} className="btn bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">Delete</button>
            )}</div>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving || !form.application_name} className="btn-primary">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Application Name *</label>
              <input className="input" value={form.application_name} onChange={(e) => setForm({ ...form, application_name: e.target.value })} autoFocus />
            </div>
          </div>

          {/* IPs */}
          <div className="grid grid-cols-2 gap-4">
            <IpInput label="Source IPs"        value={form.sources}          onChange={(v) => setForm({ ...form, sources: v })} />
            <IpInput label="Source NAT IPs"    value={form.source_nats}      onChange={(v) => setForm({ ...form, source_nats: v })} />
            <IpInput label="Destination IPs"   value={form.destinations}     onChange={(v) => setForm({ ...form, destinations: v })} />
            <IpInput label="Destination NAT IPs" value={form.destination_nats} onChange={(v) => setForm({ ...form, destination_nats: v })} />
          </div>

          {/* Ports + protocol + direction + type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Ports</label>
              <input
                className="input font-mono"
                value={form.ports}
                onChange={(e) => setForm({ ...form, ports: e.target.value })}
                placeholder="443 or 8091,8092,8093"
              />
            </div>
            <div>
              <label className="label">Protocol</label>
              <SearchableSelect
                value={form.protocol}
                onChange={(v) => setForm({ ...form, protocol: (v || 'TCP') as any })}
                options={[
                  { value: 'TCP',     label: 'TCP' },
                  { value: 'UDP',     label: 'UDP' },
                  { value: 'TCP/UDP', label: 'TCP/UDP' },
                ]}
                emptyOption={null}
              />
            </div>
            <div>
              <label className="label">Direction</label>
              <SearchableSelect
                value={form.direction}
                onChange={(v) => setForm({ ...form, direction: (v || 'Uni-Directional') as any })}
                options={[
                  { value: 'Bi-Directional', label: 'Bi-Directional' },
                  { value: 'Uni-Directional', label: 'Uni-Directional' },
                ]}
                emptyOption={null}
              />
            </div>
            <div>
              <label className="label">Type</label>
              <SearchableSelect
                value={form.rule_type}
                onChange={(v) => setForm({ ...form, rule_type: (v || 'Permanent') as any })}
                options={[
                  { value: 'Permanent', label: 'Permanent' },
                  { value: 'Temp',      label: 'Temporary' },
                ]}
                emptyOption={null}
              />
            </div>
          </div>

          {/* Temp-only */}
          {form.rule_type === 'Temp' && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 space-y-3">
              <div className="text-sm font-semibold text-amber-800">Temporary Rule Details</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Expire Date</label>
                  <input type="date" className="input" value={form.expire_date} onChange={(e) => setForm({ ...form, expire_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Days Window</label>
                  <input className="input" value={form.days_window} onChange={(e) => setForm({ ...form, days_window: e.target.value })} placeholder="e.g. 24 hrs" />
                </div>
                <div>
                  <label className="label">Time Window</label>
                  <input className="input" value={form.time_window} onChange={(e) => setForm({ ...form, time_window: e.target.value })} placeholder="e.g. 24 hrs" />
                </div>
              </div>
            </div>
          )}

          {/* Request info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">SN Call Number</label>
              <input className="input font-mono" value={form.sn_call_number} onChange={(e) => setForm({ ...form, sn_call_number: e.target.value })} placeholder="RITM1234567" />
            </div>
            <div>
              <label className="label">Request Date</label>
              <input type="date" className="input" value={form.request_date} onChange={(e) => setForm({ ...form, request_date: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label">Engineer Requested</label>
              <SearchableSelect
                value={form.engineer_requested_employee_id}
                onChange={(v) => setForm({ ...form, engineer_requested_employee_id: v })}
                options={employees.map((e) => ({
                  value: String(e.id),
                  label: e.full_name,
                  sublabel: e.employee_code || undefined,
                }))}
                emptyOption="— None —"
                placeholder="— Select engineer —"
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[80px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Reason for rule, business justification, etc."
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
