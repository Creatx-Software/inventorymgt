import { useCallback, useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { PackagePlus, ArrowDownToLine, UserPlus, RotateCcw, History } from 'lucide-react';
import clsx from 'clsx';
import { DataTable } from '../components/table/DataTable';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { Drawer } from '../components/ui/Drawer';
import { consumablesApi } from '../api/consumables';
import { vendorsApi } from '../api/lookups';
import { employeesApi, locationsApi } from '../api/lookups';
import type { ConsumableItem, ConsumableTransaction, ConsumableAssignment, Vendor, Location, Employee } from '../types/api';
import { useAuth } from '../contexts/AuthContext';

// ─── Stock badge ─────────────────────────────────────────────────────────────

function StockBadge({ item }: { item: ConsumableItem }) {
  const { current_stock: s, minimum_stock: min } = item;
  if (s <= 0) return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Out of Stock</span>;
  if (min != null && s <= min) return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">{s} (Low)</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">{s}</span>;
}

// ─── Transaction type badge ───────────────────────────────────────────────────

function TxBadge({ type }: { type: ConsumableTransaction['transaction_type'] }) {
  if (type === 'stock_in') return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">Stock In</span>;
  if (type === 'assigned') return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">Assigned</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">Returned</span>;
}

// ─── Today's date helper ──────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().slice(0, 10);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConsumableStockPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('consumables_edit');
  const canCreate = hasPermission('consumables_create');
  const canDelete = hasPermission('consumables_delete');

  // ── Reload trigger ──────────────────────────────────────────────────────────
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  // ── Lookup data ─────────────────────────────────────────────────────────────
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    vendorsApi.list({ pageSize: 500 }).then((r) => setVendors(r.data)).catch(() => {});
    locationsApi.list({ pageSize: 500 }).then((r) => setLocations(r.data)).catch(() => {});
    employeesApi.list({ pageSize: 1000 }).then((r) => setEmployees(r.data)).catch(() => {});
    consumablesApi.getCategories().then(setCategories).catch(() => {});
  }, [reloadKey]);

  // ── Category filter ─────────────────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const fetcher = useCallback(
    (p: any) => consumablesApi.list({ ...p, ...(activeCategory ? { category: activeCategory } : {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reloadKey, activeCategory],
  );

  // ── Item form drawer (create / edit) ────────────────────────────────────────
  const emptyForm = { name: '', category: '', description: '', vendor_id: '', location_id: '', unit: 'each', minimum_stock: '', remarks: '', initial_stock: '', initial_stock_date: todayISO(), initial_stock_reference: '', initial_po_number: '', initial_invoice_number: '' };
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ConsumableItem | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  };

  const openEdit = (item: ConsumableItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category || '',
      description: item.description || '',
      vendor_id: item.vendor_id?.toString() || '',
      location_id: item.location_id?.toString() || '',
      unit: item.unit,
      minimum_stock: item.minimum_stock?.toString() || '',
      remarks: item.remarks || '',
      initial_stock: '',
      initial_stock_date: todayISO(),
      initial_stock_reference: '',
      initial_po_number: '',
      initial_invoice_number: '',
    });
    setFormOpen(true);
  };

  const saveItem = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
        location_id: form.location_id ? Number(form.location_id) : null,
        unit: form.unit.trim() || 'each',
        minimum_stock: form.minimum_stock !== '' ? Number(form.minimum_stock) : null,
        remarks: form.remarks.trim() || null,
      };
      // Only send initial stock fields on create
      if (!editingItem && form.initial_stock !== '') {
        payload.initial_stock = Number(form.initial_stock);
        payload.initial_stock_date = form.initial_stock_date;
        payload.initial_stock_reference = form.initial_stock_reference.trim() || null;
        payload.initial_po_number = form.initial_po_number.trim() || null;
        payload.initial_invoice_number = form.initial_invoice_number.trim() || null;
      }
      if (editingItem) {
        await consumablesApi.update(editingItem.id, payload as any);
      } else {
        await consumablesApi.create(payload as any);
      }
      setFormOpen(false);
      reload();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async () => {
    if (!editingItem) return;
    if (!confirm(`Delete "${editingItem.name}"? It will be soft-deleted.`)) return;
    await consumablesApi.remove(editingItem.id);
    setFormOpen(false);
    reload();
  };

  // ── Action drawer (Stock In / Assign / Return) ───────────────────────────────
  const [actionOpen, setActionOpen] = useState(false);
  const [actionItem, setActionItem] = useState<ConsumableItem | null>(null);
  const [actionType, setActionType] = useState<'stock_in' | 'assign' | 'return'>('stock_in');
  const [actionForm, setActionForm] = useState({ quantity: '1', employee_id: '', transaction_date: todayISO(), reference_number: '', po_number: '', invoice_number: '', notes: '' });
  const [actioning, setActioning] = useState(false);

  const openAction = (item: ConsumableItem, type: 'stock_in' | 'assign' | 'return', e: React.MouseEvent) => {
    e.stopPropagation();
    setActionItem(item);
    setActionType(type);
    setActionForm({ quantity: '1', employee_id: '', transaction_date: todayISO(), reference_number: '', po_number: '', invoice_number: '', notes: '' });
    setActionOpen(true);
  };

  const submitAction = async () => {
    if (!actionItem) return;
    setActioning(true);
    try {
      const qty = Number(actionForm.quantity);
      if (!qty || qty < 1) throw new Error('Quantity must be at least 1');

      if (actionType === 'stock_in') {
        await consumablesApi.stockIn(actionItem.id, {
          quantity: qty,
          transaction_date: actionForm.transaction_date,
          reference_number: actionForm.reference_number || undefined,
          po_number: actionForm.po_number || undefined,
          invoice_number: actionForm.invoice_number || undefined,
          notes: actionForm.notes || undefined,
        });
      } else if (actionType === 'assign') {
        if (!actionForm.employee_id) throw new Error('Please select an employee');
        await consumablesApi.assign(actionItem.id, {
          quantity: qty,
          employee_id: Number(actionForm.employee_id),
          transaction_date: actionForm.transaction_date,
          notes: actionForm.notes || undefined,
        });
      } else {
        if (!actionForm.employee_id) throw new Error('Please select an employee');
        await consumablesApi.returnItem(actionItem.id, {
          quantity: qty,
          employee_id: Number(actionForm.employee_id),
          transaction_date: actionForm.transaction_date,
          notes: actionForm.notes || undefined,
        });
      }
      setActionOpen(false);
      reload();
    } catch (e: any) {
      alert(e.response?.data?.error || e.message || 'Action failed');
    } finally {
      setActioning(false);
    }
  };

  // ── History drawer ──────────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<ConsumableItem | null>(null);
  const [historyTab, setHistoryTab] = useState<'transactions' | 'holders'>('transactions');
  const [transactions, setTransactions] = useState<ConsumableTransaction[]>([]);
  const [assignments, setAssignments] = useState<ConsumableAssignment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (item: ConsumableItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistoryItem(item);
    setHistoryTab('transactions');
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const [tx, as] = await Promise.all([
        consumablesApi.getTransactions(item.id),
        consumablesApi.getAssignments(item.id),
      ]);
      setTransactions(tx);
      setAssignments(as);
    } catch {
      setTransactions([]);
      setAssignments([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns: ColumnDef<ConsumableItem, any>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      size: 220,
      cell: (info) => <span className="font-medium text-slate-900">{info.getValue()}</span>,
    },
    {
      accessorKey: 'category',
      header: 'Category',
      size: 140,
      cell: (info) => info.getValue()
        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{info.getValue()}</span>
        : <span className="text-slate-300">—</span>,
    },
    {
      accessorKey: 'current_stock',
      header: 'Stock',
      size: 130,
      cell: (info) => <StockBadge item={info.row.original} />,
    },
    {
      accessorKey: 'minimum_stock',
      header: 'Min Stock',
      size: 90,
      cell: (info) => info.getValue() != null ? info.getValue() : <span className="text-slate-300">—</span>,
    },
    {
      accessorKey: 'unit',
      header: 'Unit',
      size: 80,
      cell: (info) => <span className="text-slate-500">{info.getValue()}</span>,
    },
    {
      accessorKey: 'location_name',
      header: 'Location',
      size: 160,
      cell: (info) => info.getValue() || <span className="text-slate-300">—</span>,
    },
    {
      accessorKey: 'vendor_name',
      header: 'Vendor',
      size: 140,
      cell: (info) => info.getValue() || <span className="text-slate-300">—</span>,
    },
    {
      id: 'actions',
      header: '',
      size: 160,
      enableSorting: false,
      cell: (info) => {
        const item = info.row.original;
        if (item.deleted_at) return null;
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {canEdit && (
              <>
                <button
                  title="Add Stock"
                  onClick={(e) => openAction(item, 'stock_in', e)}
                  className="p-1.5 rounded hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Assign to Employee"
                  onClick={(e) => openAction(item, 'assign', e)}
                  className="p-1.5 rounded hover:bg-orange-50 text-orange-600 hover:text-orange-700 transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Return from Employee"
                  onClick={(e) => openAction(item, 'return', e)}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-700 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              title="Transaction History"
              onClick={(e) => openHistory(item, e)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-700 transition"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      },
    },
  ];

  // ── Action drawer title/subtitle helpers ────────────────────────────────────
  const actionTitle = actionType === 'stock_in' ? 'Add Stock' : actionType === 'assign' ? 'Assign to Employee' : 'Return from Employee';
  const actionSubtitle = actionItem?.name ?? '';
  const actionIcon = actionType === 'stock_in' ? <ArrowDownToLine className="w-4 h-4" /> : actionType === 'assign' ? <UserPlus className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />;

  return (
    <>
      {/* ── Category filter tabs ─────────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setActiveCategory(null)}
            className={clsx(
              'px-3 py-1 rounded-full text-sm font-medium border transition',
              activeCategory === null
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:text-brand-600',
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={clsx(
                'px-3 py-1 rounded-full text-sm font-medium border transition',
                activeCategory === cat
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:text-brand-600',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* ── Main table ───────────────────────────────────────────────────── */}
      <DataTable<ConsumableItem>
        title="Consumable Stock"
        subtitle={activeCategory ? `Category: ${activeCategory}` : 'Cables, accessories, and other bulk items'}
        columns={columns}
        fetcher={fetcher}
        onCreate={canCreate ? openCreate : undefined}
        onRowClick={canEdit ? openEdit : undefined}
        onBulkDelete={canDelete ? async (ids) => { await Promise.all(ids.map((id) => consumablesApi.remove(id))); reload(); } : undefined}
        onRestore={canEdit ? async (id) => { await consumablesApi.restore(id); reload(); } : undefined}
        stickyColumnIds={['name']}
        viewKey="consumables"
      />

      {/* ── Create / Edit drawer ─────────────────────────────────────────── */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingItem ? 'Edit Item' : 'New Consumable Item'}
        subtitle={editingItem ? `ID #${editingItem.id} · Current stock: ${editingItem.current_stock}` : 'Add a new consumable item to stock'}
        width="md"
        footer={
          <div className="flex justify-between">
            <div>
              {editingItem && canDelete && (
                <button onClick={deleteItem} className="btn bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFormOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveItem} disabled={saving || !form.name.trim()} className="btn-primary">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. USB-C Cable 1m"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <input
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Cables, Phone Parts"
                list="category-list"
              />
              <datalist id="category-list">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="label">Unit</label>
              <input
                className="input"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="each, pair, pack…"
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[60px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vendor</label>
              <SearchableSelect
                value={form.vendor_id}
                onChange={(v) => setForm({ ...form, vendor_id: v })}
                options={vendors.map((v) => ({ value: String(v.id), label: v.name }))}
              />
            </div>
            <div>
              <label className="label">Storage Location</label>
              <SearchableSelect
                value={form.location_id}
                onChange={(v) => setForm({ ...form, location_id: v })}
                options={locations.map((l) => ({ value: String(l.id), label: l.name }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Minimum Stock Alert</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.minimum_stock}
              onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })}
              placeholder="Leave blank to disable alert"
            />
          </div>

          <div>
            <label className="label">Remarks</label>
            <textarea
              className="input min-h-[60px]"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </div>

          {/* Opening stock — create only */}
          {!editingItem && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
              <div className="text-sm font-semibold text-blue-800">Opening Stock <span className="font-normal text-blue-600/70">(optional)</span></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quantity</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.initial_stock}
                    onChange={(e) => setForm({ ...form, initial_stock: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="label">Date</label>
                  <input
                    className="input"
                    type="date"
                    value={form.initial_stock_date}
                    onChange={(e) => setForm({ ...form, initial_stock_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">PO Number</label>
                  <input
                    className="input"
                    value={form.initial_po_number}
                    onChange={(e) => setForm({ ...form, initial_po_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Invoice Number</label>
                  <input
                    className="input"
                    value={form.initial_invoice_number}
                    onChange={(e) => setForm({ ...form, initial_invoice_number: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Reference / Note (optional)</label>
                <input
                  className="input"
                  value={form.initial_stock_reference}
                  onChange={(e) => setForm({ ...form, initial_stock_reference: e.target.value })}
                  placeholder="Delivery note, courier ref, etc."
                />
              </div>
              <div className="text-xs text-blue-700/70">
                Leave quantity at 0 to create the item without any stock — you can add stock later.
              </div>
            </div>
          )}
        </div>
      </Drawer>

      {/* ── Action drawer (Stock In / Assign / Return) ───────────────────── */}
      <Drawer
        open={actionOpen}
        onClose={() => setActionOpen(false)}
        title={actionTitle}
        subtitle={actionSubtitle}
        width="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setActionOpen(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={submitAction}
              disabled={actioning}
              className={clsx(
                'btn',
                actionType === 'stock_in' && 'bg-blue-600 hover:bg-blue-700 text-white',
                actionType === 'assign' && 'bg-orange-600 hover:bg-orange-700 text-white',
                actionType === 'return' && 'btn-primary',
              )}
            >
              {actioning ? 'Processing…' : (
                <span className="flex items-center gap-1.5">{actionIcon} {actionTitle}</span>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {actionType === 'stock_in' && actionItem && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
              Current stock: <strong>{actionItem.current_stock} {actionItem.unit}</strong>
            </div>
          )}
          {actionType === 'assign' && actionItem && (
            <div className="rounded-lg bg-orange-50 border border-orange-100 px-4 py-3 text-sm text-orange-800">
              Available: <strong>{actionItem.current_stock} {actionItem.unit}</strong>
            </div>
          )}
          {actionType === 'return' && actionItem && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
              Returning to stock for: <strong>{actionItem.name}</strong>
            </div>
          )}

          <div>
            <label className="label">Quantity *</label>
            <input
              className="input"
              type="number"
              min="1"
              value={actionForm.quantity}
              onChange={(e) => setActionForm({ ...actionForm, quantity: e.target.value })}
              autoFocus
            />
          </div>

          {(actionType === 'assign' || actionType === 'return') && (
            <div>
              <label className="label">Employee *</label>
              <SearchableSelect
                value={actionForm.employee_id}
                onChange={(v) => setActionForm({ ...actionForm, employee_id: v })}
                options={employees
                  .filter((emp) => emp.is_active && !emp.deleted_at)
                  .map((emp) => ({
                    value: String(emp.id),
                    label: emp.full_name,
                    sublabel: emp.employee_code || undefined,
                  }))}
                emptyOption={null}
                placeholder="— Select employee —"
              />
            </div>
          )}

          {actionType === 'stock_in' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">PO Number</label>
                  <input
                    className="input"
                    value={actionForm.po_number}
                    onChange={(e) => setActionForm({ ...actionForm, po_number: e.target.value })}
                    placeholder="e.g. PO/2024/045"
                  />
                </div>
                <div>
                  <label className="label">Invoice Number</label>
                  <input
                    className="input"
                    value={actionForm.invoice_number}
                    onChange={(e) => setActionForm({ ...actionForm, invoice_number: e.target.value })}
                    placeholder="e.g. INV-2024-1234"
                  />
                </div>
              </div>
              <div>
                <label className="label">Reference / Note (optional)</label>
                <input
                  className="input"
                  value={actionForm.reference_number}
                  onChange={(e) => setActionForm({ ...actionForm, reference_number: e.target.value })}
                  placeholder="Delivery note, courier ref, etc."
                />
              </div>
            </>
          )}

          <div>
            <label className="label">Date</label>
            <input
              className="input"
              type="date"
              value={actionForm.transaction_date}
              onChange={(e) => setActionForm({ ...actionForm, transaction_date: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[60px]"
              value={actionForm.notes}
              onChange={(e) => setActionForm({ ...actionForm, notes: e.target.value })}
              placeholder="Optional notes"
            />
          </div>
        </div>
      </Drawer>

      {/* ── History drawer ───────────────────────────────────────────────── */}
      <Drawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Stock History"
        subtitle={historyItem?.name}
        width="lg"
      >
        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-slate-200">
          <button
            onClick={() => setHistoryTab('transactions')}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition',
              historyTab === 'transactions'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            All Transactions ({transactions.length})
          </button>
          <button
            onClick={() => setHistoryTab('holders')}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition',
              historyTab === 'holders'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            Current Holders ({assignments.length})
          </button>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Loading…</div>
        ) : historyTab === 'transactions' ? (
          transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No transactions yet</div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-start justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <TxBadge type={tx.transaction_type} />
                      <span className="font-semibold text-slate-900">{tx.quantity} {historyItem?.unit}</span>
                    </div>
                    {tx.employee_name && (
                      <div className="text-slate-600">
                        {tx.transaction_type === 'assigned' ? 'To' : 'From'}: <strong>{tx.employee_name}</strong>
                        {tx.employee_code ? ` (${tx.employee_code})` : ''}
                      </div>
                    )}
                    {tx.transaction_type === 'stock_in' && (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600">
                        <span>
                          <span className="text-slate-400">PO:</span>{' '}
                          {tx.po_number
                            ? <span className="font-mono text-slate-900">{tx.po_number}</span>
                            : <span className="text-slate-300">—</span>}
                        </span>
                        <span>
                          <span className="text-slate-400">Invoice:</span>{' '}
                          {tx.invoice_number
                            ? <span className="font-mono text-slate-900">{tx.invoice_number}</span>
                            : <span className="text-slate-300">—</span>}
                        </span>
                      </div>
                    )}
                    {tx.reference_number && (
                      <div className="text-slate-500 text-xs">Ref: {tx.reference_number}</div>
                    )}
                    {tx.notes && <div className="text-slate-500 text-xs italic">{tx.notes}</div>}
                  </div>
                  <div className="text-right text-slate-400 text-xs shrink-0 ml-4">
                    <div>{new Date(tx.transaction_date).toLocaleDateString('en-GB')}</div>
                    {tx.performed_by_username && <div>by {tx.performed_by_username}</div>}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          assignments.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No items currently held by employees</div>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <div key={a.employee_id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{a.employee_name}</div>
                    {a.employee_code && <div className="text-slate-500 text-xs">{a.employee_code}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{a.net_quantity} {historyItem?.unit}</div>
                    <div className="text-xs text-slate-400">{a.total_assigned} assigned · {a.total_returned} returned</div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </Drawer>
    </>
  );
}
