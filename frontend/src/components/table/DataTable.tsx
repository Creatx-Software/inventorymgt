import { useEffect, useMemo, useState, useCallback } from 'react';
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
  ArrowUp, ArrowDown, Loader2, X,
} from 'lucide-react';
import clsx from 'clsx';
import type { ListParams, PaginatedResponse } from '../../types/api';

export interface DataTableProps<T extends { id: number }> {
  title: string;
  subtitle?: string;
  columns: ColumnDef<T, any>[];
  fetcher: (params: ListParams) => Promise<PaginatedResponse<T>>;
  onRowClick?: (row: T) => void;
  onCreate?: () => void;
  onBulkDelete?: (ids: number[]) => Promise<void>;
  pageSizes?: number[];
  defaultPageSize?: number;
  stickyColumnIds?: string[];
  extraActions?: React.ReactNode;
}

export function DataTable<T extends { id: number }>({
  title, subtitle, columns, fetcher, onRowClick, onCreate, onBulkDelete,
  pageSizes = [25, 50, 100, 200, 500],
  defaultPageSize = 100,
  stickyColumnIds = [],
  extraActions,
}: DataTableProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColMenu, setShowColMenu] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add a checkbox column at the start
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
        pageSize,
        search: search || undefined,
        sortBy: sort?.id,
        sortDir: sort ? (sort.desc ? 'desc' : 'asc') : undefined,
      });
      setData(r.data);
      setTotal(r.pagination.total);
    } finally {
      setLoading(false);
    }
  }, [fetcher, page, pageSize, search, sorting]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selectedIds = Object.keys(rowSelection).map(Number);
  const hasSelection = selectedIds.length > 0;

  const handleBulkDelete = async () => {
    if (!onBulkDelete || !hasSelection) return;
    if (!confirm(`Delete ${selectedIds.length} selected item(s)?`)) return;
    await onBulkDelete(selectedIds);
    setRowSelection({});
    load();
  };

  // CSV export of current page
  const exportCsv = () => {
    const visibleCols = table.getVisibleLeafColumns().filter((c) => c.id !== '__select__');
    const header = visibleCols.map((c) => (typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id)).join(',');
    const rows = data.map((row) =>
      visibleCols.map((col) => {
        const val = (row as any)[col.id];
        if (val == null) return '';
        const s = String(val).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // sticky offsets
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {hasSelection && onBulkDelete && (
            <button onClick={handleBulkDelete} className="btn bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
              <Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})
            </button>
          )}
          {extraActions}
          <button onClick={exportCsv} className="btn-secondary"><Download className="w-4 h-4" /> Export</button>
          <button onClick={load} className="btn-secondary" title="Refresh"><RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} /></button>
          <div className="relative">
            <button onClick={() => setShowColMenu(!showColMenu)} className="btn-secondary"><Settings2 className="w-4 h-4" /> Columns</button>
            {showColMenu && (
              <div className="absolute right-0 mt-2 w-56 card py-2 z-30 max-h-80 overflow-y-auto">
                <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase">Toggle columns</div>
                {table.getAllLeafColumns().filter((c) => c.id !== '__select__').map((col) => (
                  <label key={col.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={col.getIsVisible()} onChange={col.getToggleVisibilityHandler()}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                    {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                  </label>
                ))}
              </div>
            )}
          </div>
          {onCreate && (
            <button onClick={onCreate} className="btn-primary"><Plus className="w-4 h-4" /> New</button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="card p-3">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search..."
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
      </div>

      {/* Table */}
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
                </tr>
              ))}
            </thead>
            <tbody>
              {loading && data.length === 0 && (
                <tr><td colSpan={allColumns.length} className="text-center py-12 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin inline" />
                </td></tr>
              )}
              {!loading && data.length === 0 && (
                <tr><td colSpan={allColumns.length} className="text-center py-12 text-slate-400">No data</td></tr>
              )}
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={clsx(
                    'border-b border-slate-100 hover:bg-brand-50/40 transition-colors',
                    onRowClick && 'cursor-pointer',
                    row.getIsSelected() && 'bg-brand-50/60',
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
                        )}
                        style={sticky ? { left: stickyOffsets[cell.column.id] ?? 0 } : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
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
