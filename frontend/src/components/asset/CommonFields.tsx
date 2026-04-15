import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { Vendor, Location, Department, Employee } from '../../types/api';
import type { AssetStatus } from '../../types/assets';

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1.5 text-slate-400 hover:text-brand-600 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export interface CommonFormState {
  serial_number: string;
  asset_name: string;
  vendor_id: string;
  model: string;
  location_id: string;
  department_id: string;
  employee_id: string;
  status_id: string;
  po_number: string;
  invoice_number: string;
  remarks: string;
}

export const emptyCommon: CommonFormState = {
  serial_number: '', asset_name: '', vendor_id: '', model: '', location_id: '',
  department_id: '', employee_id: '', status_id: '', po_number: '', invoice_number: '', remarks: '',
};

export function commonToPayload(c: CommonFormState) {
  return {
    serial_number: c.serial_number || null,
    asset_name: c.asset_name || null,
    vendor_id: c.vendor_id ? Number(c.vendor_id) : null,
    model: c.model || null,
    location_id: c.location_id ? Number(c.location_id) : null,
    department_id: c.department_id ? Number(c.department_id) : null,
    employee_id: c.employee_id ? Number(c.employee_id) : null,
    status_id: c.status_id ? Number(c.status_id) : null,
    po_number: c.po_number || null,
    invoice_number: c.invoice_number || null,
    remarks: c.remarks || null,
  };
}

export function rowToCommon(row: any): CommonFormState {
  return {
    serial_number: row.serial_number || '',
    asset_name: row.asset_name || '',
    vendor_id: row.vendor_id ? String(row.vendor_id) : '',
    model: row.model || '',
    location_id: row.location_id ? String(row.location_id) : '',
    department_id: row.department_id ? String(row.department_id) : '',
    employee_id: row.employee_id ? String(row.employee_id) : '',
    status_id: row.status_id ? String(row.status_id) : '',
    po_number: row.po_number || '',
    invoice_number: row.invoice_number || '',
    remarks: row.remarks || '',
  };
}

export function CommonFields({
  value, onChange, vendors, locations, departments, employees, statuses,
}: {
  value: CommonFormState;
  onChange: (v: CommonFormState) => void;
  vendors: Vendor[];
  locations: Location[];
  departments: Department[];
  employees: Employee[];
  statuses: AssetStatus[];
}) {
  const set = <K extends keyof CommonFormState>(k: K, v: CommonFormState[K]) =>
    onChange({ ...value, [k]: v });

  const vendorName = vendors.find((v) => String(v.id) === value.vendor_id)?.name || '';
  const locationName = locations.find((l) => String(l.id) === value.location_id)?.name || '';
  const departmentName = departments.find((d) => String(d.id) === value.department_id)?.name || '';
  const employeeDisplay = (() => {
    const e = employees.find((e) => String(e.id) === value.employee_id);
    if (!e) return '';
    return e.employee_code ? `${e.full_name} (${e.employee_code})` : e.full_name;
  })();
  const statusName = statuses.find((s) => String(s.id) === value.status_id)?.name || '';

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="label flex items-center">Serial Number <CopyButton value={value.serial_number} /></label>
        <input className="input font-mono" value={value.serial_number}
          onChange={(e) => set('serial_number', e.target.value)}
          placeholder="Auto-generated if blank" />
      </div>
      <div>
        <label className="label flex items-center">Asset Name <CopyButton value={value.asset_name} /></label>
        <input className="input" value={value.asset_name} onChange={(e) => set('asset_name', e.target.value)} />
      </div>
      <div>
        <label className="label flex items-center">Vendor / Make <CopyButton value={vendorName} /></label>
        <select className="input" value={value.vendor_id} onChange={(e) => set('vendor_id', e.target.value)}>
          <option value="">— None —</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label flex items-center">Model <CopyButton value={value.model} /></label>
        <input className="input" value={value.model} onChange={(e) => set('model', e.target.value)} />
      </div>
      <div>
        <label className="label flex items-center">Status * <CopyButton value={statusName} /></label>
        <select className="input" value={value.status_id} onChange={(e) => set('status_id', e.target.value)} required>
          <option value="">— Select —</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label flex items-center">Employee (Assigned To) <CopyButton value={employeeDisplay} /></label>
        <select className="input" value={value.employee_id} onChange={(e) => set('employee_id', e.target.value)}>
          <option value="">— Unassigned —</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}{e.employee_code ? ` (${e.employee_code})` : ''}</option>)}
        </select>
      </div>
      <div>
        <label className="label flex items-center">Location <CopyButton value={locationName} /></label>
        <select className="input" value={value.location_id} onChange={(e) => set('location_id', e.target.value)}>
          <option value="">— None —</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label flex items-center">Department <CopyButton value={departmentName} /></label>
        <select className="input" value={value.department_id} onChange={(e) => set('department_id', e.target.value)}>
          <option value="">— None —</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label flex items-center">PO Number <CopyButton value={value.po_number} /></label>
        <input className="input" value={value.po_number} onChange={(e) => set('po_number', e.target.value)} />
      </div>
      <div>
        <label className="label flex items-center">Invoice Number <CopyButton value={value.invoice_number} /></label>
        <input className="input" value={value.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="label flex items-center">Remarks <CopyButton value={value.remarks} /></label>
        <textarea className="input min-h-[70px]" value={value.remarks} onChange={(e) => set('remarks', e.target.value)} />
      </div>
    </div>
  );
}

export function StatusBadge({ name, color }: { name?: string; color?: string }) {
  if (!name) return <span className="text-slate-300">—</span>;
  return (
    <span
      className="inline-block px-2 py-0.5 text-[11px] font-medium rounded-full border"
      style={{
        backgroundColor: (color || '#64748b') + '15',
        borderColor: (color || '#64748b') + '40',
        color: color || '#475569',
      }}
    >
      {name}
    </span>
  );
}

export function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB');
}
