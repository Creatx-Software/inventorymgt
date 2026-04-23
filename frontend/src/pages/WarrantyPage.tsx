import { useEffect, useState } from 'react';
import { dashboardApi, type AlertBuckets, type WarrantyAlert } from '../api/dashboard';
import { ShieldAlert, Clock, Loader2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

type BucketKey = 'all' | 'expired' | 'within30' | 'within60' | 'within90';
type Mode = 'warranty' | 'eol';

const BUCKET_META: { key: BucketKey; label: string; color: string; rowColor: string }[] = [
  { key: 'all',      label: 'All',       color: 'bg-slate-100 text-slate-700 border-slate-200',   rowColor: '' },
  { key: 'expired',  label: 'Expired',   color: 'bg-red-50 text-red-700 border-red-200',           rowColor: 'bg-red-50/40' },
  { key: 'within30', label: '< 30 days', color: 'bg-orange-50 text-orange-700 border-orange-200',  rowColor: 'bg-orange-50/40' },
  { key: 'within60', label: '< 60 days', color: 'bg-amber-50 text-amber-700 border-amber-200',     rowColor: 'bg-amber-50/30' },
  { key: 'within90', label: '< 90 days', color: 'bg-yellow-50 text-yellow-700 border-yellow-200',  rowColor: '' },
];

function daysLabel(days: number) {
  if (days < 0) return { text: `${Math.abs(days)}d ago`, cls: 'text-red-600 font-semibold' };
  if (days <= 30) return { text: `in ${days}d`, cls: 'text-orange-600 font-semibold' };
  if (days <= 60) return { text: `in ${days}d`, cls: 'text-amber-600 font-semibold' };
  return { text: `in ${days}d`, cls: 'text-slate-600' };
}

function flattenBuckets(b: AlertBuckets): WarrantyAlert[] {
  return [
    ...b.expired,
    ...b.within30,
    ...b.within60,
    ...b.within90,
  ];
}

function getBucketForRow(a: WarrantyAlert): BucketKey {
  if (a.days_remaining < 0)       return 'expired';
  if (a.days_remaining <= 30)     return 'within30';
  if (a.days_remaining <= 60)     return 'within60';
  return 'within90';
}

export default function WarrantyPage() {
  const [mode, setMode] = useState<Mode>('warranty');
  const [warrantyData, setWarrantyData] = useState<AlertBuckets | null>(null);
  const [eolData, setEolData] = useState<AlertBuckets | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeBucket, setActiveBucket] = useState<BucketKey>('all');

  const load = async () => {
    setLoading(true);
    try {
      const [w, e] = await Promise.all([dashboardApi.warranty(), dashboardApi.eol()]);
      setWarrantyData(w);
      setEolData(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const buckets = mode === 'warranty' ? warrantyData : eolData;

  const allRows = buckets ? flattenBuckets(buckets) : [];

  const filteredRows = activeBucket === 'all'
    ? allRows
    : allRows.filter((a) => getBucketForRow(a) === activeBucket);

  const counts: Record<BucketKey, number> = {
    all:      allRows.length,
    expired:  buckets?.expired.length  || 0,
    within30: buckets?.within30.length || 0,
    within60: buckets?.within60.length || 0,
    within90: buckets?.within90.length || 0,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Warranty & EOL</h1>
          <p className="text-sm text-slate-500 mt-1">Assets with expiring or expired warranty / end-of-life dates</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary">
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMode('warranty'); setActiveBucket('all'); }}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition border',
            mode === 'warranty'
              ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
          )}
        >
          <ShieldAlert className="w-4 h-4" /> Warranty
        </button>
        <button
          onClick={() => { setMode('eol'); setActiveBucket('all'); }}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition border',
            mode === 'eol'
              ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
          )}
        >
          <Clock className="w-4 h-4" /> End of Life
        </button>
      </div>

      {/* Bucket filter pills */}
      <div className="flex flex-wrap gap-2">
        {BUCKET_META.map(({ key, label, color }) => {
          const isActive = activeBucket === key;
          return (
            <button
              key={key}
              onClick={() => setActiveBucket(key)}
              className={clsx(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition',
                isActive ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : color + ' hover:opacity-80',
              )}
            >
              {label}
              <span className={clsx(
                'text-[11px] font-semibold px-1.5 py-0.5 rounded-full',
                isActive ? 'bg-white/20 text-white' : 'bg-black/10',
              )}>
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading && allRows.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-2">
            <ShieldAlert className="w-10 h-10 text-emerald-400" />
            <div className="text-slate-500 text-sm">No alerts in this category</div>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-360px)]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {['Asset Type', 'Serial Number', 'Asset Name', 'Model', 'Vendor', 'Employee', 'Location', 'Department', 'Expiry Date', 'Status'].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((a) => {
                  const bucket = getBucketForRow(a);
                  const rowMeta = BUCKET_META.find((b) => b.key === bucket)!;
                  const dl = daysLabel(a.days_remaining);
                  return (
                    <tr key={`${a.asset_table}-${a.id}`} className={clsx('border-b border-slate-100 hover:bg-brand-50/20', rowMeta.rowColor)}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          {a.asset_label}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700 whitespace-nowrap">{a.serial_number}</td>
                      <td className="px-3 py-2 text-slate-800">{a.asset_name || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{a.model || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">{a.vendor_name || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {a.employee_name
                          ? <><span className="text-slate-800">{a.employee_name}</span>{a.employee_code && <span className="text-slate-400 ml-1">({a.employee_code})</span>}</>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">{a.location_name || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">{a.department_name || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-600">
                        {new Date(a.expiry_date).toLocaleDateString('en-GB')}
                      </td>
                      <td className={clsx('px-3 py-2 text-xs whitespace-nowrap', dl.cls)}>
                        {dl.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredRows.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-sm text-slate-500">
            Showing {filteredRows.length} record{filteredRows.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
