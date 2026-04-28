import { useEffect, useState } from 'react';
import { auditLogsApi, type AuditLog } from '../api/operations';
import { Loader2, ChevronLeft, ChevronRight, Search, RefreshCw, Filter, X } from 'lucide-react';
import clsx from 'clsx';
import { SearchableSelect } from '../components/ui/SearchableSelect';

const actionColor: Record<string, string> = {
  CREATE:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE:  'bg-blue-50 text-blue-700 border-blue-200',
  DELETE:  'bg-red-50 text-red-700 border-red-200',
  RESTORE: 'bg-purple-50 text-purple-700 border-purple-200',
  LOGIN:   'bg-slate-50 text-slate-700 border-slate-200',
  IMPORT:  'bg-amber-50 text-amber-700 border-amber-200',
  EXPORT:  'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export default function AuditLogsPage() {
  const [data, setData] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await auditLogsApi.list({ page, pageSize, search, action, entity_type: entityType, from, to });
      setData(r.data);
      setTotal(r.pagination.total);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, pageSize]);
  useEffect(() => { const t = setTimeout(() => { setPage(1); load(); }, 300); return () => clearTimeout(t); }, [search, action, entityType, from, to]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const clearFilters = () => { setSearch(''); setAction(''); setEntityType(''); setFrom(''); setTo(''); };
  const hasFilters = search || action || entityType || from || to;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-1">Every mutation recorded in the system</p>
        </div>
        <button onClick={load} className="btn-secondary">
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-slate-700">
          <Filter className="w-4 h-4" /> Filters
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs text-brand-600 hover:underline flex items-center gap-1">
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search user or entity..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <SearchableSelect
            value={action}
            onChange={setAction}
            options={Object.keys(actionColor).map((a) => ({ value: a, label: a }))}
            emptyOption="All actions"
            placeholder="All actions"
          />
          <input className="input" placeholder="Entity type (e.g. endpoint)" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-380px)]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">Time</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">User</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">Action</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">Entity</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">ID</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && data.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin inline" /></td></tr>
              )}
              {!loading && data.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">No audit logs</td></tr>
              )}
              {data.map((log) => (
                <tr key={log.id} onClick={() => setSelected(log)} className="border-b border-slate-100 hover:bg-brand-50/40 cursor-pointer">
                  <td className="px-3 py-1.5 text-xs text-slate-600 whitespace-nowrap">{new Date(log.created_at).toLocaleString('en-GB')}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-900 whitespace-nowrap">{log.user_full_name || log.username || 'System'}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${actionColor[log.action] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{log.entity_type}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{log.entity_id ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-slate-500">{log.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="input py-1 text-sm w-auto">
              {[50, 100, 200, 500].map((s) => <option key={s} value={s}>{s} / page</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-2 py-1"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm text-slate-600">Page {page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary px-2 py-1"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Details modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-6 h-16 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">Audit Entry #{selected.id}</div>
                <div className="text-xs text-slate-500">{new Date(selected.created_at).toLocaleString('en-GB')}</div>
              </div>
              <button onClick={() => setSelected(null)} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-xs text-slate-500">User</div><div className="font-medium">{selected.user_full_name || selected.username || 'System'}</div></div>
                <div><div className="text-xs text-slate-500">Action</div>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 text-[11px] font-medium rounded-full border ${actionColor[selected.action]}`}>{selected.action}</span>
                </div>
                <div><div className="text-xs text-slate-500">Entity</div><div className="font-mono">{selected.entity_type} {selected.entity_id != null && `#${selected.entity_id}`}</div></div>
                <div><div className="text-xs text-slate-500">IP</div><div className="font-mono text-xs">{selected.ip_address || '—'}</div></div>
              </div>
              {selected.changes && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Changes</div>
                  <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto max-h-96">
                    {JSON.stringify(typeof selected.changes === 'string' ? JSON.parse(selected.changes) : selected.changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
