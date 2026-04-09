import { useCallback, useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/table/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { incidentsApi, type Incident, type IncidentWithLinks } from '../api/operations';
import { serversApi, networkDevicesApi } from '../api/assets';
import type { Server, NetworkDevice } from '../types/assets';
import { fmtDate } from '../components/asset/CommonFields';
import { X } from 'lucide-react';

const fmtDateTime = (v: string | null) => (v ? new Date(v).toLocaleString('en-GB') : '—');

const columns: ColumnDef<Incident, any>[] = [
  { accessorKey: 'id', header: 'ID', size: 70 },
  { accessorKey: 'incident_code', header: 'Code', size: 160, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'start_datetime', header: 'Started', size: 170, cell: (i) => fmtDateTime(i.getValue() as string) },
  { accessorKey: 'end_datetime', header: 'Ended', size: 170, cell: (i) => fmtDateTime(i.getValue() as string) },
  { accessorKey: 'application_impacted', header: 'Application', size: 200, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'can_id', header: 'CAN ID', size: 120, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'problem_statement', header: 'Problem', size: 300, cell: (i) => (
    <span className="line-clamp-1">{i.getValue() as string || <span className="text-slate-300">—</span>}</span>
  ) },
  { accessorKey: 'created_at', header: 'Created', size: 110, cell: (i) => fmtDate(i.getValue() as string) },
];

interface FormState {
  incident_code: string;
  start_datetime: string;
  end_datetime: string;
  application_impacted: string;
  can_id: string;
  problem_statement: string;
  impact_assessment: string;
  business_impact: string;
  observations: string;
  teams_involved: string;
  ips_impacted: string;
  server_ids: number[];
  network_device_ids: number[];
}

const empty: FormState = {
  incident_code: '', start_datetime: '', end_datetime: '',
  application_impacted: '', can_id: '',
  problem_statement: '', impact_assessment: '', business_impact: '',
  observations: '', teams_involved: '', ips_impacted: '',
  server_ids: [], network_device_ids: [],
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function IncidentsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Incident | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [servers, setServers] = useState<Server[]>([]);
  const [devices, setDevices] = useState<NetworkDevice[]>([]);

  const fetcher = useCallback((p: any) => incidentsApi.list(p), [reloadKey]);

  useEffect(() => {
    serversApi.list({ pageSize: 500 }).then((r) => setServers(r.data as any)).catch(() => {});
    networkDevicesApi.list({ pageSize: 500 }).then((r) => setDevices(r.data as any)).catch(() => {});
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, start_datetime: toLocalInput(new Date().toISOString()) });
    setOpen(true);
  };

  const openEdit = async (row: Incident) => {
    const full: IncidentWithLinks = await incidentsApi.get(row.id);
    setEditing(row);
    setForm({
      incident_code: full.incident_code || '',
      start_datetime: toLocalInput(full.start_datetime),
      end_datetime: toLocalInput(full.end_datetime),
      application_impacted: full.application_impacted || '',
      can_id: full.can_id || '',
      problem_statement: full.problem_statement || '',
      impact_assessment: full.impact_assessment || '',
      business_impact: full.business_impact || '',
      observations: full.observations || '',
      teams_involved: full.teams_involved || '',
      ips_impacted: full.ips_impacted || '',
      server_ids: full.servers.map((s) => s.id),
      network_device_ids: full.network_devices.map((d) => d.id),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.start_datetime) { alert('Start date is required'); return; }
    setSaving(true);
    try {
      const payload = {
        incident_code: form.incident_code || null,
        start_datetime: form.start_datetime ? new Date(form.start_datetime).toISOString().slice(0, 19).replace('T', ' ') : null,
        end_datetime: form.end_datetime ? new Date(form.end_datetime).toISOString().slice(0, 19).replace('T', ' ') : null,
        application_impacted: form.application_impacted || null,
        can_id: form.can_id || null,
        problem_statement: form.problem_statement || null,
        impact_assessment: form.impact_assessment || null,
        business_impact: form.business_impact || null,
        observations: form.observations || null,
        teams_involved: form.teams_involved || null,
        ips_impacted: form.ips_impacted || null,
        server_ids: form.server_ids,
        network_device_ids: form.network_device_ids,
      };
      if (editing) await incidentsApi.update(editing.id, payload);
      else await incidentsApi.create(payload);
      setOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!editing || !confirm('Delete this incident?')) return;
    await incidentsApi.remove(editing.id);
    setOpen(false);
    setReloadKey((k) => k + 1);
  };

  const toggle = (key: 'server_ids' | 'network_device_ids', id: number) => {
    const arr = form[key];
    setForm({
      ...form,
      [key]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id],
    });
  };

  return (
    <>
      <DataTable<Incident>
        title="Network Incidents"
        subtitle="Outages, degradations, and impact reports"
        columns={columns}
        fetcher={fetcher}
        onCreate={openNew}
        onRowClick={openEdit}
        onBulkDelete={async (ids) => { await incidentsApi.bulkDelete(ids); setReloadKey((k) => k + 1); }}
        stickyColumnIds={['incident_code']}
        viewKey="incidents"
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Incident' : 'New Incident'}
        subtitle={editing ? `ID #${editing.id}` : 'Log a new network incident'}
        width="lg"
        footer={
          <div className="flex justify-between">
            <div>{editing && <button onClick={remove} className="btn bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">Delete</button>}</div>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Incident Code</label>
              <input className="input" value={form.incident_code} onChange={(e) => setForm({ ...form, incident_code: e.target.value })} placeholder="INC-2024-001" />
            </div>
            <div>
              <label className="label">CAN ID</label>
              <input className="input" value={form.can_id} onChange={(e) => setForm({ ...form, can_id: e.target.value })} />
            </div>
            <div>
              <label className="label">Start Date/Time *</label>
              <input type="datetime-local" className="input" value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })} required />
            </div>
            <div>
              <label className="label">End Date/Time</label>
              <input type="datetime-local" className="input" value={form.end_datetime} onChange={(e) => setForm({ ...form, end_datetime: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label">Application Impacted</label>
              <input className="input" value={form.application_impacted} onChange={(e) => setForm({ ...form, application_impacted: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Problem Statement</label>
            <textarea className="input min-h-[80px]" value={form.problem_statement} onChange={(e) => setForm({ ...form, problem_statement: e.target.value })} />
          </div>
          <div>
            <label className="label">Impact Assessment</label>
            <textarea className="input min-h-[70px]" value={form.impact_assessment} onChange={(e) => setForm({ ...form, impact_assessment: e.target.value })} />
          </div>
          <div>
            <label className="label">Business Impact</label>
            <textarea className="input min-h-[70px]" value={form.business_impact} onChange={(e) => setForm({ ...form, business_impact: e.target.value })} />
          </div>
          <div>
            <label className="label">Observations</label>
            <textarea className="input min-h-[70px]" value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Teams Involved</label>
              <input className="input" value={form.teams_involved} onChange={(e) => setForm({ ...form, teams_involved: e.target.value })} />
            </div>
            <div>
              <label className="label">IPs Impacted</label>
              <input className="input font-mono text-xs" value={form.ips_impacted} onChange={(e) => setForm({ ...form, ips_impacted: e.target.value })} />
            </div>
          </div>

          {/* Linked servers */}
          <div>
            <label className="label">Linked Servers</label>
            <MultiSelect
              items={servers.map((s) => ({ id: s.id, label: s.application_name || s.serial_number, sub: s.host_name || s.serial_number }))}
              selected={form.server_ids}
              onToggle={(id) => toggle('server_ids', id)}
              placeholder="Search servers by name, host..."
            />
          </div>

          {/* Linked network devices */}
          <div>
            <label className="label">Linked Network Devices</label>
            <MultiSelect
              items={devices.map((d) => ({ id: d.id, label: d.device_name || d.serial_number, sub: d.host_name || d.serial_number }))}
              selected={form.network_device_ids}
              onToggle={(id) => toggle('network_device_ids', id)}
              placeholder="Search network devices..."
            />
          </div>
        </div>
      </Drawer>
    </>
  );
}

function MultiSelect({
  items, selected, onToggle, placeholder,
}: {
  items: { id: number; label: string; sub?: string }[];
  selected: number[];
  onToggle: (id: number) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(q.toLowerCase()) ||
    (i.sub || '').toLowerCase().includes(q.toLowerCase()),
  );

  const selectedItems = items.filter((i) => selected.includes(i.id));

  return (
    <div className="space-y-2">
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedItems.map((i) => (
            <span key={i.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              {i.label}
              <button onClick={() => onToggle(i.id)} className="hover:text-brand-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input className="input" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      {q && (
        <div className="card max-h-48 overflow-y-auto">
          {filtered.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">No matches</div>}
          {filtered.slice(0, 20).map((i) => (
            <button
              key={i.id}
              onClick={() => onToggle(i.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 ${selected.includes(i.id) ? 'bg-brand-50' : ''}`}
            >
              <div className="font-medium text-slate-900">{i.label}</div>
              {i.sub && <div className="text-xs text-slate-500">{i.sub}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
