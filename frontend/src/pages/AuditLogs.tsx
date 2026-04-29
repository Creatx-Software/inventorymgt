import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auditLogsApi, type AuditLog, type AuditEntityType } from '../api/operations';
import {
  Loader2, ChevronLeft, ChevronRight, Search, RefreshCw, Filter, X,
  Plus, Pencil, Trash2, RotateCcw, LogIn, Upload, Download, ExternalLink,
  ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';
import { SearchableSelect } from '../components/ui/SearchableSelect';

const ACTION_META: Record<string, { label: string; icon: any; color: string; verb: string }> = {
  CREATE:  { label: 'Created',  icon: Plus,     color: 'emerald', verb: 'created' },
  UPDATE:  { label: 'Updated',  icon: Pencil,   color: 'blue',    verb: 'updated' },
  DELETE:  { label: 'Deleted',  icon: Trash2,   color: 'red',     verb: 'deleted' },
  RESTORE: { label: 'Restored', icon: RotateCcw,color: 'purple',  verb: 'restored' },
  LOGIN:   { label: 'Logged in',icon: LogIn,    color: 'slate',   verb: 'logged in' },
  IMPORT:  { label: 'Imported', icon: Upload,   color: 'amber',   verb: 'imported' },
  EXPORT:  { label: 'Exported', icon: Download, color: 'indigo',  verb: 'exported' },
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string; dot: string; pill: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  red:     { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500',     pill: 'bg-red-50 text-red-700 border-red-200' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  dot: 'bg-purple-500',  pill: 'bg-purple-50 text-purple-700 border-purple-200' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200',   dot: 'bg-slate-500',   pill: 'bg-slate-50 text-slate-700 border-slate-200' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500',   pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  dot: 'bg-indigo-500',  pill: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function timeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function AuditLogsPage() {
  const navigate = useNavigate();
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
  const [entityTypes, setEntityTypes] = useState<AuditEntityType[]>([]);

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
  useEffect(() => { auditLogsApi.entityTypes().then(setEntityTypes).catch(() => {}); }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const clearFilters = () => { setSearch(''); setAction(''); setEntityType(''); setFrom(''); setTo(''); };
  const hasFilters = search || action || entityType || from || to;

  // Group by day
  const groupedByDay = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    for (const log of data) {
      const day = dayLabel(log.created_at);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(log);
    }
    return Array.from(map.entries());
  }, [data]);

  const goToEntity = (log: AuditLog) => {
    if (log.entity_link) navigate(log.entity_link);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-1">Every change recorded in the system</p>
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
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
            <input className="input pl-9" placeholder="Search user or entity..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <SearchableSelect
            value={action}
            onChange={setAction}
            options={Object.keys(ACTION_META).map((a) => ({ value: a, label: ACTION_META[a].label }))}
            emptyOption="All actions"
            placeholder="All actions"
          />
          <SearchableSelect
            value={entityType}
            onChange={setEntityType}
            options={entityTypes.map((e) => ({ value: e.key, label: e.displayName }))}
            emptyOption="All entity types"
            placeholder="All entity types"
          />
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
        </div>
      </div>

      {/* Timeline */}
      <div className="card p-6">
        {loading && data.length === 0 && (
          <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-600 inline" /></div>
        )}
        {!loading && data.length === 0 && (
          <div className="text-center py-16 text-sm text-slate-400">No activity found</div>
        )}

        <div className="space-y-8">
          {groupedByDay.map(([day, items]) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{day}</div>
                <div className="flex-1 h-px bg-slate-100" />
                <div className="text-[11px] text-slate-400">{items.length} {items.length === 1 ? 'event' : 'events'}</div>
              </div>

              <div className="space-y-1">
                {items.map((log) => {
                  const meta = ACTION_META[log.action] || { label: log.action, icon: Pencil, color: 'slate', verb: log.action.toLowerCase() };
                  const colors = COLOR_CLASSES[meta.color];
                  const Icon = meta.icon;
                  const userName = log.user_full_name || log.username || 'System';
                  const initials = (userName[0] || '?').toUpperCase();
                  const hasLink = !!log.entity_link;
                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelected(log)}
                      className="group flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      {/* User avatar */}
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                        {initials}
                      </div>

                      {/* Action icon */}
                      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', colors.bg, colors.text)}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>

                      {/* Body */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-700 leading-snug">
                          <span className="font-medium text-slate-900">{userName}</span>{' '}
                          <span className={colors.text}>{meta.verb}</span>{' '}
                          <span className="text-slate-500">{log.entity_type_display.toLowerCase()}</span>{' '}
                          {log.entity_label ? (
                            <span
                              className={clsx(
                                'font-medium text-slate-900',
                                hasLink && 'underline-offset-2 group-hover:underline group-hover:text-brand-700',
                              )}
                              onClick={(e) => { if (hasLink) { e.stopPropagation(); goToEntity(log); } }}
                            >
                              {log.entity_label}
                            </span>
                          ) : log.entity_id != null ? (
                            <span className="font-mono text-slate-400">#{log.entity_id}</span>
                          ) : null}
                          {log.entity_secondary && (
                            <span className="text-slate-500"> · {log.entity_secondary}</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{timeShort(log.created_at)}</span>
                          {log.ip_address && <span className="font-mono">· {log.ip_address}</span>}
                        </div>
                      </div>

                      {hasLink && (
                        <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 mt-2 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-200">
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

      {/* Detail modal */}
      {selected && <AuditDetailModal log={selected} onClose={() => setSelected(null)} onGotoEntity={() => { goToEntity(selected); setSelected(null); }} />}
    </div>
  );
}

function parseChanges(raw: any): any {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

function AuditDetailModal({ log, onClose, onGotoEntity }: { log: AuditLog; onClose: () => void; onGotoEntity: () => void }) {
  const meta = ACTION_META[log.action] || { label: log.action, icon: Pencil, color: 'slate', verb: log.action.toLowerCase() };
  const colors = COLOR_CLASSES[meta.color];
  const Icon = meta.icon;
  const changes = parseChanges(log.changes);

  // For UPDATE — try to render before/after diff
  const isDiff = log.action === 'UPDATE' && changes && typeof changes === 'object'
    && 'before' in changes && 'after' in changes;

  const diffRows = (() => {
    if (!isDiff) return null;
    const before = changes.before || {};
    const after = changes.after || {};
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    const SKIP = ['id', 'created_at', 'updated_at', 'deleted_at'];
    const normalize = (v: any) => {
      // Compare FK { id, label } objects by id only
      if (v && typeof v === 'object' && 'id' in v && 'label' in v && Object.keys(v).length === 2) {
        return v.id;
      }
      return v;
    };
    return keys
      .filter((k) => !SKIP.includes(k))
      .map((k) => {
        const b = before[k];
        const a = after[k];
        const same = JSON.stringify(normalize(b)) === JSON.stringify(normalize(a));
        return { key: k, before: b, after: a, same };
      })
      .filter((r) => !r.same);
  })();

  const fmt = (v: any) => {
    if (v == null) return <span className="text-slate-300 italic">empty</span>;
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    // FK reference shape: { id, label }
    if (v && typeof v === 'object' && 'id' in v && 'label' in v && Object.keys(v).length === 2) {
      if (v.label) {
        return (
          <span>
            {v.label}
            <span className="text-slate-400 text-xs ml-1">#{v.id}</span>
          </span>
        );
      }
      return <span className="font-mono text-xs">#{v.id}</span>;
    }
    if (typeof v === 'object') return <code className="text-xs">{JSON.stringify(v)}</code>;
    return String(v);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="px-6 h-16 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', colors.bg, colors.text)}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">{meta.label} {log.entity_type_display.toLowerCase()}</div>
              <div className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString('en-GB')}</div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">User</div>
              <div className="font-medium text-slate-900 mt-0.5">{log.user_full_name || log.username || 'System'}</div>
              {log.username && log.user_full_name && <div className="text-xs text-slate-500">{log.username}</div>}
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Action</div>
              <span className={`inline-block mt-0.5 px-2 py-0.5 text-[11px] font-medium rounded-full border ${colors.pill}`}>
                {log.action}
              </span>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Entity</div>
              {log.entity_label ? (
                <button
                  onClick={log.entity_link ? onGotoEntity : undefined}
                  disabled={!log.entity_link}
                  className={clsx(
                    'mt-0.5 inline-flex items-center gap-2 text-left',
                    log.entity_link && 'text-brand-700 hover:underline',
                  )}
                >
                  <span className="font-medium">{log.entity_label}</span>
                  {log.entity_secondary && <span className="text-xs text-slate-500">· {log.entity_secondary}</span>}
                  {log.entity_link && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <div className="font-mono text-xs text-slate-600 mt-0.5">
                  {log.entity_type}{log.entity_id != null && ` #${log.entity_id}`}
                </div>
              )}
            </div>
            {log.ip_address && (
              <div className="col-span-2">
                <div className="text-xs text-slate-500 uppercase tracking-wider">IP Address</div>
                <div className="font-mono text-xs text-slate-700 mt-0.5">{log.ip_address}</div>
              </div>
            )}
          </div>

          {/* Diff view for UPDATE */}
          {diffRows && diffRows.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Changes ({diffRows.length} {diffRows.length === 1 ? 'field' : 'fields'})</div>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Field</th>
                      <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Before</th>
                      <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffRows.map((r) => (
                      <tr key={r.key} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.key}</td>
                        <td className="px-3 py-2 text-slate-700"><div className="rounded bg-red-50 px-2 py-0.5 inline-block">{fmt(r.before)}</div></td>
                        <td className="px-3 py-2 text-slate-700"><div className="rounded bg-emerald-50 px-2 py-0.5 inline-block">{fmt(r.after)}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Diff view but no diffs (only metadata changed) */}
          {diffRows && diffRows.length === 0 && (
            <div className="text-xs text-slate-500 italic">No field changes (metadata-only update)</div>
          )}

          {/* Raw payload for non-UPDATE actions */}
          {!isDiff && changes && (
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Payload</div>
              <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto max-h-80">
                {JSON.stringify(changes, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
