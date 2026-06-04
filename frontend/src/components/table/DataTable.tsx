import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table';
import {
  Search, Plus, Trash2, Download, RefreshCw, Settings2, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, Loader2, X, Trash, RotateCcw, SlidersHorizontal,
} from 'lucide-react';
import clsx from 'clsx';
import type { ListParams, PaginatedResponse } from '../../types/api';

export interface FilterFieldDef {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface DataTableProps<T extends { id: number }> {
  title: string;
  subtitle?: string;
  columns: ColumnDef<T, any>[];
  fetcher: (params: ListParams) => Promise<PaginatedResponse<T>>;
  onRowClick?: (row: T) => void;
  onCreate?: () => void;
  onBulkDelete?: (ids: number[]) => Promise<void>;
  onRestore?: (id: number) => Promise<void>;
  onHardDelete?: (id: number) => Promise<void>;
  onBulkHardDelete?: (ids: number[]) => Promise<void>;
  pageSizes?: number[];
  defaultPageSize?: number;
  stickyColumnIds?: string[];
  extraActions?: React.ReactNode | ((ctx: { selectedIds: number[] }) => React.ReactNode);
  /** Unique key used to persist column visibility + pageSize in localStorage */
  viewKey?: string;
  /** Initial sort state — column id + direction */
  defaultSorting?: { id: string; desc: boolean }[];
  /** Column filter fields shown in the filter panel */
  filterFields?: FilterFieldDef[];
}

export function DataTable<T extends { id: number; deleted_at?: string | null }>({
  title, subtitle, columns, fetcher, onRowClick, onCreate, onBulkDelete, onRestore,
  onHardDelete, onBulkHardDelete,
  pageSizes = [25, 50, 100, 200, 500],
  defaultPageSize = 100,
  stickyColumnIds = [],
  extraActions,
  viewKey,
  defaultSorting = [],
  filterFields,
}: DataTableProps<T>) {
  const storageKey = viewKey ? `dt:${viewKey}` : null;
  const loadPersisted = () => {
    if (!storageKey) return { visibility: {}, pageSize: defaultPageSize };
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { visibility: {}, pageSize: defaultPageSize };
      const p = JSON.parse(raw);
      return { visibility: p.visibility || {}, pageSize: p.pageSize || defaultPageSize };
    } catch {
      return { visibility: {}, pageSize: defaultPageSize };
    }
  };
  const persisted = loadPersisted();

  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(persisted.pageSize);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sorting, setSorting] = useState<SortingState>(defaultSorting);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(persisted.visibility);
  const [showColMenu, setShowColMenu] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeColumnFilters = useMemo(
    () => Object.fromEntries(Object.entries(columnFilters).filter(([, v]) => v !== '')),
    [columnFilters],
  );
  const activeFilterCount = Object.keys(activeColumnFilters).length;

  // Persist visibility + pageSize whenever they change
  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify({ visibility: columnVisibility, pageSize }));
  }, [storageKey, columnVisibility, pageSize]);

  // Keyboard shortcut: "/" focuses the search input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const allColumns = useMemo<ColumnDef<T, any>[]>(() => [
    {
      id: '__select__',
      size: 40,
      header: ({ table }) => (
        <input
          type="checkbox"
          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          checked={table.getIsAllRowsSelected()}
          ref={(el) => { if (el) el.indeterminate = table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected(); }}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
    },
    ...columns,
  ], [columns]);

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, rowSelection, columnVisibility },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sort = sorting[0];
      const r = await fetcher({
        page,
        pageSize: pageSize === 0 ? 99999 : pageSize,
        search: search || undefined,
        sortBy: sort?.id,
        sortDir: sort ? (sort.desc ? 'desc' : 'asc') : undefined,
        includeDeleted: showDeleted,
        filters: activeFilterCount > 0 ? activeColumnFilters : undefined,
      });
      setData(r.data);
      setTotal(r.pagination.total);
    } finally {
      setLoading(false);
    }
  }, [fetcher, page, pageSize, search, sorting, showDeleted, activeColumnFilters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selectedIds = Object.keys(rowSelection).map(Number);
  const hasSelection = selectedIds.length > 0;

  const setFilter = (key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setPage(1);
  };

  const handleBulkDelete = async () => {
    if (!onBulkDelete || !hasSelection) return;
    if (!confirm(`Delete ${selectedIds.length} selected item(s)?`)) return;
    await onBulkDelete(selectedIds);
    setRowSelection({});
    load();
  };

  const handleBulkHardDelete = async () => {
    if (!onBulkHardDelete || !hasSelection) return;
    if (!confirm(`Permanently delete ${selectedIds.length} selected item(s)? This cannot be undone.`)) return;
    await onBulkHardDelete(selectedIds);
    setRowSelection({});
    load();
  };

  const handleRestore = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRestore) return;
    if (!confirm('Restore this item?')) return;
    await onRestore(id);
    load();
  };

  const handleHardDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onHardDelete) return;
    if (!confirm('Permanently delete this item? This cannot be undone.')) return;
    await onHardDelete(id);
    load();
  };

  const exportXlsx = () => {
    const visibleCols = table.getVisibleLeafColumns().filter((c) => c.id !== '__select__');
    const headers = visibleCols.map((c) => (typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id));
    const rows = data.map((row) =>
      visibleCols.map((col) => {
        const val = (row as any)[col.id];
        return val == null ? '' : val;
      })
    );
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
    const now = new Date();
    const stamp = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + '_' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g, '_')}_${stamp}.xlsx`);
  };

  const stickyOffsets = useMemo(() => {
    const offsets: Record<string, number> = { __select__: 0 };
    let acc = 40;
    for (const id of stickyColumnIds) {
      offsets[id] = acc;
      const col = columns.find((c: any) => c.accessorKey === id || c.id === id) as any;
      acc += col?.size || 180;
    }
    return offsets;
  }, [stickyColumnIds, columns]);

  const isSticky = (id: string) => id === '__select__' || stickyColumnIds.includes(id);

  const hasFilterFields = filterFields && filterFields.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {hasSelection && showDeleted && onBulkHardDelete && (
            <button onClick={handleBulkHardDelete} className="btn bg-red-600 text-white border border-red-700 hover:bg-red-700">
              <Trash2 className="w-4 h-4" /> Delete Permanently ({selectedIds.length})
            </button>
          )}
          {hasSelection && !showDeleted && onBulkDelete && (
            <button onClick={handleBulkDelete} className="btn bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
              <Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})
            </button>
          )}
          {typeof extraActions === 'function' ? extraActions({ selectedIds }) : extraActions}
          <button onClick={exportXlsx} className="btn-secondary"><Download className="w-4 h-4" /> Export</button>
          <button onClick={load} className="btn-secondary" title="Refresh"><RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} /></button>
          <div className="relative">
            <button onClick={() => setShowColMenu(!showColMenu)} className="btn-secondary"><Settings2 className="w-4 h-4" /> Columns</button>
            {showColMenu && (
              <div className="absolute right-0 mt-2 w-64 card py-2 z-30 max-h-80 overflow-y-auto">
                <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase">Toggle columns</div>
                {table.getAllLeafColumns().filter((c) => c.id !== '__select__').map((col) => (
                  <label key={col.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={col.getIsVisible()} onChange={col.getToggleVisibilityHandler()}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                    {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                  </label>
                ))}
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <label className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={showDeleted} onChange={(e) => { setShowDeleted(e.target.checked); setPage(1); }}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                    <span className="text-slate-700">Show deleted items</span>
                  </label>
                </div>
              </div>
            )}
          </div>
          {onCreate && (
            <button onClick={onCreate} className="btn-primary"><Plus className="w-4 h-4" /> New</button>
          )}
        </div>
      </div>

      {/* Search + Filter panel */}
      <div className="card p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              placeholder="Search... (press / to focus)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input pl-9 pr-9"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {hasFilterFields && (
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={clsx(
                'btn-secondary relative',
                (showFilters || activeFilterCount > 0) && 'border-brand-300 bg-brand-50 text-brand-700',
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && hasFilterFields && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {filterFields!.map((field) => (
                <div key={field.key}>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={columnFilters[field.key] || ''}
                      onChange={(e) => setFilter(field.key, e.target.value)}
                      className="input py-1.5 text-sm w-full"
                    >
                      <option value="">All</option>
                      {field.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={columnFilters[field.key] || ''}
                      onChange={(e) => setFilter(field.key, e.target.value)}
                      placeholder={field.placeholder || `Filter…`}
                      className="input py-1.5 text-sm w-full"
                    />
                  )}
                </div>
              ))}
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="mt-2 text-xs text-brand-600 hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active filter chips — shown when panel is closed but filters are active */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500 font-medium">Filters:</span>
          {Object.entries(activeColumnFilters).map(([key, value]) => {
            const field = filterFields?.find((f) => f.key === key);
            const displayValue = field?.type === 'select'
              ? (field.options?.find((o) => o.value === value)?.label ?? value)
              : value;
            return (
              <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 border border-brand-200 text-xs text-brand-700">
                <span className="font-medium">{field?.label ?? key}:</span> {displayValue}
                <button onClick={() => setFilter(key, '')} className="ml-0.5 text-brand-400 hover:text-brand-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          <button onClick={clearAllFilters} className="text-xs text-slate-400 hover:text-slate-600 underline">
            Clear all
          </button>
        </div>
      )}

      {showDeleted && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
          <Trash className="w-4 h-4" />
          Showing soft-deleted items. Click the <RotateCcw className="w-3 h-3 inline" /> icon on a row to restore it.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-300px)] relative">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => {
                    const sticky = isSticky(header.id);
                    return (
                      <th
                        key={header.id}
                        className={clsx(
                          'text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200 whitespace-nowrap',
                          sticky && 'sticky bg-slate-50 z-20',
                          header.column.getCanSort() && 'cursor-pointer select-none hover:bg-slate-100',
                        )}
                        style={sticky ? { left: stickyOffsets[header.id] ?? 0 } : undefined}
                        onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' && <ArrowUp className="w-3 h-3" />}
                          {header.column.getIsSorted() === 'desc' && <ArrowDown className="w-3 h-3" />}
                        </div>
                      </th>
                    );
                  })}
                  {showDeleted && onRestore && (
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">Action</th>
                  )}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading && data.length === 0 && (
                <tr><td colSpan={allColumns.length + (showDeleted && onRestore ? 1 : 0)} className="text-center py-12 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin inline" />
                </td></tr>
              )}
              {!loading && data.length === 0 && (
                <tr><td colSpan={allColumns.length + (showDeleted && onRestore ? 1 : 0)} className="text-center py-12 text-slate-400">No data</td></tr>
              )}
              {table.getRowModel().rows.map((row) => {
                const isDeleted = !!(row.original as any).deleted_at;
                return (
                  <tr
                    key={row.id}
                    onClick={() => !isDeleted && onRowClick?.(row.original)}
                    className={clsx(
                      'border-b border-slate-100 hover:bg-brand-50/40 transition-colors',
                      onRowClick && !isDeleted && 'cursor-pointer',
                      row.getIsSelected() && 'bg-brand-50/60',
                      isDeleted && 'opacity-60',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const sticky = isSticky(cell.column.id);
                      return (
                        <td
                          key={cell.id}
                          className={clsx(
                            'px-3 py-2 text-slate-700 whitespace-nowrap',
                            sticky && 'sticky bg-white z-[1]',
                            row.getIsSelected() && sticky && 'bg-brand-50',
                            isDeleted && sticky && 'bg-slate-50',
                          )}
                          style={sticky ? { left: stickyOffsets[cell.column.id] ?? 0 } : undefined}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                    {showDeleted && (onRestore || onHardDelete) && (
                      <td className="px-3 py-2">
                        {isDeleted && (
                          <div className="flex items-center gap-1.5">
                            {onRestore && (
                              <button
                                onClick={(e) => handleRestore(row.original.id, e)}
                                className="btn bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 py-1 px-2 text-xs"
                              >
                                <RotateCcw className="w-3 h-3" /> Restore
                              </button>
                            )}
                            {onHardDelete && (
                              <button
                                onClick={(e) => handleHardDelete(row.original.id, e)}
                                className="btn bg-red-600 text-white border border-red-700 hover:bg-red-700 py-1 px-2 text-xs"
                                title="Delete permanently — cannot be undone"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>
              {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="input py-1 text-sm w-auto"
            >
              {pageSizes.map((s) => <option key={s} value={s}>{s} / page</option>)}
              <option value={0}>All</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-2 py-1">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-600">Page {page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary px-2 py-1">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
