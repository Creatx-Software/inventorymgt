import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { SearchableSelect } from '../ui/SearchableSelect';
import { vendorsApi, locationsApi, departmentsApi, employeesApi } from '../../api/lookups';
import { assetStatusesApi } from '../../api/assets';
import type { Vendor, Location, Department, Employee } from '../../types/api';
import type { AssetStatus } from '../../types/assets';
import type { BulkField } from './bulkEditFields';

interface ActiveField {
  field: BulkField;
  value: any;
}

export function BulkEditModal({
  open, onClose, onSubmit, selectedCount, fields, title,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (updates: Record<string, any>) => Promise<{ updated: number; errors: { id: number; error: string }[] }>;
  selectedCount: number;
  fields: BulkField[];
  title: string;
}) {
  const [active, setActive] = useState<ActiveField[]>([]);
  const [picker, setPicker] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statuses, setStatuses] = useState<AssetStatus[]>([]);
  const [confirmStep, setConfirmStep] = useState(false);
  const [typedCount, setTypedCount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ updated: number; errors: { id: number; error: string }[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      vendorsApi.list({ pageSize: 500 }),
      locationsApi.list({ pageSize: 500 }),
      departmentsApi.list({ pageSize: 500 }),
      employeesApi.list({ pageSize: 1000 }),
      assetStatusesApi.list(),
    ]).then(([v, l, d, e, s]) => {
      setVendors(v.data);
      setLocations(l.data);
      setDepartments(d.data);
      setEmployees(e.data);
      setStatuses(s);
    }).catch(() => {});
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setActive([]); setPicker(false); setConfirmStep(false);
      setTypedCount(''); setSubmitting(false); setResult(null);
    }
  }, [open]);

  if (!open) return null;

  const usedKeys = new Set(active.map((a) => a.field.key));
  const availableFields = fields.filter((f) => !usedKeys.has(f.key));

  const addField = (key: string) => {
    const f = fields.find((x) => x.key === key);
    if (!f) return;
    let initial: any = '';
    if (f.kind === 'bool') initial = ''; // tri-state (empty = not set yet)
    setActive([...active, { field: f, value: initial }]);
    setPicker(false);
  };

  const setValue = (idx: number, v: any) => {
    setActive(active.map((a, i) => (i === idx ? { ...a, value: v } : a)));
  };

  const removeField = (idx: number) => {
    setActive(active.filter((_, i) => i !== idx));
  };

  // Build the payload — converting "" to null where appropriate
  const buildPayload = (): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const a of active) {
      const k = a.field.key;
      const v = a.value;
      if (a.field.kind === 'bool') {
        if (v === 'true') out[k] = true;
        else if (v === 'false') out[k] = false;
        // empty = leave alone (skip)
      } else if (a.field.kind === 'fk-vendor' || a.field.kind === 'fk-location' || a.field.kind === 'fk-department' || a.field.kind === 'fk-employee') {
        out[k] = v ? Number(v) : null;
      } else if (a.field.kind === 'fk-status') {
        if (v) out[k] = Number(v);
      } else if (a.field.kind === 'enum') {
        if (v) out[k] = v;
      } else if (a.field.kind === 'date') {
        out[k] = v || null;
      } else { // text, textarea
        out[k] = v === '' ? null : v;
      }
    }
    return out;
  };

  const validForApply = active.length > 0 && active.every((a) => {
    if (a.field.kind === 'bool') return a.value === 'true' || a.value === 'false';
    if (a.field.kind === 'fk-status' || a.field.kind === 'enum') return !!a.value;
    return true; // empty allowed for text (means clear)
  });

  const requireTyping = selectedCount > 100;

  const handleApply = async () => {
    setSubmitting(true);
    try {
      const r = await onSubmit(buildPayload());
      setResult(r);
    } catch (e: any) {
      alert(e.response?.data?.error || e.message || 'Bulk update failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[760px] max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 h-16 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <div className="font-semibold text-slate-900">Bulk Edit {title}</div>
            <div className="text-xs text-slate-500">
              {result
                ? 'Done'
                : confirmStep
                  ? 'Review and confirm'
                  : `${selectedCount} record${selectedCount === 1 ? '' : 's'} selected`}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* RESULT */}
          {result && (
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="text-lg font-semibold text-slate-900">Bulk update complete</div>
              <div className="text-sm text-slate-500 mt-2">
                <strong className="text-emerald-600">{result.updated}</strong> updated
                {result.errors.length > 0 && (
                  <> · <strong className="text-red-600">{result.errors.length}</strong> errors</>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="card p-4 mt-4 max-h-48 overflow-y-auto text-left">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Errors:</div>
                  <div className="space-y-1 text-xs font-mono">
                    {result.errors.slice(0, 50).map((e, i) => (
                      <div key={i} className="text-red-600">ID {e.id}: {e.error}</div>
                    ))}
                    {result.errors.length > 50 && (
                      <div className="text-slate-500">... and {result.errors.length - 50} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONFIRMATION */}
          {!result && confirmStep && (
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  This will apply <strong>{active.length} change{active.length === 1 ? '' : 's'}</strong> to{' '}
                  <strong>{selectedCount} record{selectedCount === 1 ? '' : 's'}</strong>. This action cannot be undone via the UI (each asset can be edited individually after).
                </div>
              </div>
              <div className="card p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Changes</div>
                <div className="space-y-2 text-sm">
                  {active.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-slate-500 min-w-[140px]">{a.field.label}:</span>
                      <span className="font-medium text-slate-900">{formatPreview(a, vendors, locations, departments, employees, statuses)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {requireTyping && (
                <div>
                  <label className="label">
                    Type <strong>{selectedCount}</strong> to confirm
                  </label>
                  <input
                    className="input"
                    value={typedCount}
                    onChange={(e) => setTypedCount(e.target.value)}
                    placeholder={String(selectedCount)}
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}

          {/* EDIT STEP */}
          {!result && !confirmStep && (
            <>
              {active.length === 0 && (
                <div className="text-center py-6 text-sm text-slate-500">
                  Click <strong>Add field</strong> below to start choosing fields to update.
                </div>
              )}

              <div className="space-y-3">
                {active.map((a, idx) => (
                  <div key={a.field.key} className="card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700">{a.field.label}</label>
                      <button onClick={() => removeField(idx)} className="text-slate-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {renderInput(a, idx, setValue, { vendors, locations, departments, employees, statuses })}
                    {a.field.hint && <div className="text-xs text-slate-400 mt-1.5">{a.field.hint}</div>}
                  </div>
                ))}
              </div>

              <div className="relative">
                <button
                  onClick={() => setPicker(!picker)}
                  disabled={availableFields.length === 0}
                  className="btn-secondary w-full justify-center"
                >
                  <Plus className="w-4 h-4" /> Add field
                  {availableFields.length === 0 && active.length > 0 && (
                    <span className="text-xs text-slate-400">— no more fields</span>
                  )}
                </button>
                {picker && availableFields.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 card max-h-72 overflow-y-auto z-10 py-1">
                    {availableFields.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => addField(f.key)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between shrink-0">
          {result ? (
            <button onClick={onClose} className="btn-primary ml-auto">Close</button>
          ) : confirmStep ? (
            <>
              <button onClick={() => setConfirmStep(false)} className="btn-secondary">Back</button>
              <button
                onClick={handleApply}
                disabled={submitting || (requireTyping && typedCount !== String(selectedCount))}
                className="btn-primary"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Apply to {selectedCount}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="btn-secondary">Cancel</button>
              <button onClick={() => setConfirmStep(true)} disabled={!validForApply} className="btn-primary">
                Continue
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function renderInput(
  a: ActiveField,
  idx: number,
  setValue: (idx: number, v: any) => void,
  ctx: { vendors: Vendor[]; locations: Location[]; departments: Department[]; employees: Employee[]; statuses: AssetStatus[] },
) {
  const f = a.field;
  switch (f.kind) {
    case 'text':
      return <input className="input" value={a.value || ''} onChange={(e) => setValue(idx, e.target.value)} placeholder="Leave empty to clear field" />;
    case 'textarea':
      return <textarea className="input min-h-[60px]" value={a.value || ''} onChange={(e) => setValue(idx, e.target.value)} placeholder="Leave empty to clear field" />;
    case 'date':
      return <input type="date" className="input" value={a.value || ''} onChange={(e) => setValue(idx, e.target.value)} />;
    case 'bool':
      return (
        <div className="flex gap-2">
          {[
            { v: 'true', label: 'Yes' },
            { v: 'false', label: 'No' },
          ].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setValue(idx, opt.v)}
              className={clsx(
                'btn flex-1 justify-center',
                a.value === opt.v
                  ? opt.v === 'true' ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      );
    case 'enum':
      return (
        <SearchableSelect
          value={a.value || ''}
          onChange={(v) => setValue(idx, v)}
          options={f.options || []}
          emptyOption={null}
          placeholder="— Select —"
        />
      );
    case 'fk-vendor':
      return (
        <SearchableSelect
          value={a.value || ''}
          onChange={(v) => setValue(idx, v)}
          options={ctx.vendors.map((v) => ({ value: String(v.id), label: v.name }))}
          emptyOption="(clear / unassign)"
        />
      );
    case 'fk-location':
      return (
        <SearchableSelect
          value={a.value || ''}
          onChange={(v) => setValue(idx, v)}
          options={ctx.locations.map((l) => ({ value: String(l.id), label: l.name }))}
          emptyOption="(clear)"
        />
      );
    case 'fk-department':
      return (
        <SearchableSelect
          value={a.value || ''}
          onChange={(v) => setValue(idx, v)}
          options={ctx.departments.map((d) => ({ value: String(d.id), label: d.name }))}
          emptyOption="(clear)"
        />
      );
    case 'fk-employee':
      return (
        <SearchableSelect
          value={a.value || ''}
          onChange={(v) => setValue(idx, v)}
          options={ctx.employees.map((e) => ({
            value: String(e.id),
            label: e.full_name,
            sublabel: e.employee_code || undefined,
          }))}
          emptyOption="(unassign)"
        />
      );
    case 'fk-status':
      return (
        <SearchableSelect
          value={a.value || ''}
          onChange={(v) => setValue(idx, v)}
          options={ctx.statuses.map((s) => ({ value: String(s.id), label: s.name }))}
          emptyOption={null}
        />
      );
  }
}

function formatPreview(
  a: ActiveField,
  vendors: Vendor[], locations: Location[], departments: Department[], employees: Employee[], statuses: AssetStatus[],
): string {
  const v = a.value;
  switch (a.field.kind) {
    case 'bool':         return v === 'true' ? 'Yes' : v === 'false' ? 'No' : '(skip)';
    case 'fk-vendor':    return v ? (vendors.find((x) => String(x.id) === v)?.name || 'unknown') : '(clear)';
    case 'fk-location':  return v ? (locations.find((x) => String(x.id) === v)?.name || 'unknown') : '(clear)';
    case 'fk-department':return v ? (departments.find((x) => String(x.id) === v)?.name || 'unknown') : '(clear)';
    case 'fk-employee':  return v ? (employees.find((x) => String(x.id) === v)?.full_name || 'unknown') : '(unassign)';
    case 'fk-status':    return v ? (statuses.find((x) => String(x.id) === v)?.name || 'unknown') : '(unset)';
    case 'enum':         return v || '(unset)';
    case 'date':         return v || '(clear)';
    default:             return v === '' || v == null ? '(clear)' : String(v);
  }
}
