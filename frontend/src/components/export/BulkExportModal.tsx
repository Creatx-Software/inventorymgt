import { useState } from 'react';
import { X, Download, FileSpreadsheet, Loader2, Laptop, Monitor, Smartphone, Phone, Server, Printer, Network, Package } from 'lucide-react';
import { api } from '../../api/client';

const ASSET_TYPES = [
  { key: 'endpoints',       label: 'Endpoints',       icon: Laptop },
  { key: 'monitors',        label: 'Monitors',        icon: Monitor },
  { key: 'mobile_devices',  label: 'Mobile Devices',  icon: Smartphone },
  { key: 'ip_phones',       label: 'IP Phones',       icon: Phone },
  { key: 'servers',         label: 'Servers',         icon: Server },
  { key: 'printers',        label: 'Printers',        icon: Printer },
  { key: 'network_devices', label: 'Network Devices', icon: Network },
  { key: 'other_assets',    label: 'Other Assets',    icon: Package },
];

export function BulkExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(ASSET_TYPES.map((t) => t.key)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(selected.size === ASSET_TYPES.length ? new Set() : new Set(ASSET_TYPES.map((t) => t.key)));
  };

  const download = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    setError('');
    try {
      const types = Array.from(selected).join(',');
      const res = await api.get(`/export/bulk?types=${types}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all_assets_${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const allSelected = selected.size === ASSET_TYPES.length;
  const noneSelected = selected.size === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="px-6 h-16 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">Export All Assets</div>
              <div className="text-xs text-slate-500">Select categories to include</div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Select all toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Asset Categories</span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-brand-600 hover:text-brand-800 transition"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          {/* Category checkboxes */}
          <div className="grid grid-cols-2 gap-2">
            {ASSET_TYPES.map(({ key, label, icon: Icon }) => {
              const checked = selected.has(key);
              return (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                    checked
                      ? 'border-brand-400 bg-brand-50 text-brand-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={checked}
                    onChange={() => toggle(key)}
                  />
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${checked ? 'bg-brand-600' : 'bg-slate-100'}`}>
                    <Icon className={`w-4 h-4 ${checked ? 'text-white' : 'text-slate-400'}`} />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                  {checked && <div className="ml-auto w-4 h-4 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>}
                </label>
              );
            })}
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500">
            Each selected category will be a separate sheet. A <strong className="text-slate-700">Summary</strong> sheet with all assets combined is always included.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center rounded-b-2xl">
          <span className="text-xs text-slate-500">
            {selected.size} of {ASSET_TYPES.length} selected
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={download}
              disabled={loading || noneSelected}
              className="btn-primary"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {loading ? 'Exporting…' : 'Download Excel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
