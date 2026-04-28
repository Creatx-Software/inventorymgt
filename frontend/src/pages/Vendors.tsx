import { useCallback, useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/table/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { vendorsApi } from '../api/lookups';
import { api } from '../api/client';
import type { Vendor } from '../types/api';
import { Package, PackageOpen, Layers, Loader2 } from 'lucide-react';
import {
  RelatedAssetGroups, RelatedConsumableList, VendorModelsRollup, CountBadge,
  type RelatedAssetGroup, type RelatedConsumable, type VendorModelRow,
} from '../components/related/RelatedPanels';

const columns: ColumnDef<Vendor, any>[] = [
  { accessorKey: 'id', header: 'ID', size: 70 },
  { accessorKey: 'name', header: 'Name', size: 240 },
  { accessorKey: 'website', header: 'Website', size: 240, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'support_contact', header: 'Support Contact', size: 240, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'created_at', header: 'Created', size: 160, cell: (i) => new Date(i.getValue()).toLocaleDateString('en-GB') },
];

interface RelatedData {
  groups: RelatedAssetGroup[];
  totalCount: number;
  models: VendorModelRow[];
  modelsCount: number;
  consumables: RelatedConsumable[];
  consumablesCount: number;
}

type Tab = 'details' | 'assets' | 'models' | 'consumables';

export default function VendorsPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState({ name: '', website: '', support_contact: '' });
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>('details');
  const [related, setRelated] = useState<RelatedData | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const fetcher = useCallback((p: any) => vendorsApi.list(p), [reloadKey]);

  const openNew = () => {
    setEditing(null); setRelated(null); setTab('details');
    setForm({ name: '', website: '', support_contact: '' });
    setDrawerOpen(true);
  };

  const openEdit = (row: Vendor) => {
    setEditing(row); setRelated(null); setTab('details');
    setForm({ name: row.name, website: row.website || '', support_contact: row.support_contact || '' });
    setDrawerOpen(true);
  };

  useEffect(() => {
    if (!editing || tab === 'details' || related) return;
    setRelatedLoading(true);
    api.get(`/vendors/${editing.id}/related`)
      .then((r) => setRelated(r.data))
      .finally(() => setRelatedLoading(false));
  }, [tab, editing, related]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        website: form.website || null,
        support_contact: form.support_contact || null,
      };
      if (editing) await vendorsApi.update(editing.id, payload as any);
      else await vendorsApi.create(payload as any);
      setDrawerOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirm(`Delete vendor "${editing.name}"?`)) return;
    await vendorsApi.remove(editing.id);
    setDrawerOpen(false);
    setReloadKey((k) => k + 1);
  };

  return (
    <>
      <DataTable<Vendor>
        title="Vendors"
        subtitle="Manufacturers and suppliers"
        columns={columns}
        fetcher={fetcher}
        onCreate={openNew}
        onRowClick={openEdit}
        onBulkDelete={async (ids) => { await vendorsApi.bulkDelete(ids); setReloadKey((k) => k + 1); }}
        onRestore={async (id) => { await vendorsApi.restore(id); setReloadKey((k) => k + 1); }}
        stickyColumnIds={['name']}
        viewKey="vendors"
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Vendor' : 'New Vendor'}
        subtitle={editing ? `ID #${editing.id}` : 'Add a new vendor'}
        width="lg"
        footer={
          <div className="flex justify-between">
            <div>
              {editing && (
                <button onClick={remove} className="btn bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">Delete</button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDrawerOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving || !form.name} className="btn-primary">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        }
      >
        {editing && (
          <div className="flex gap-1 mb-5 border-b border-slate-200 -mx-6 px-6 overflow-x-auto">
            <TabButton active={tab === 'details'} onClick={() => setTab('details')} label="Details" />
            <TabButton active={tab === 'assets'} onClick={() => setTab('assets')}
              label="Assets" icon={Package} count={related?.totalCount} />
            <TabButton active={tab === 'models'} onClick={() => setTab('models')}
              label="Models supplied" icon={Layers} count={related?.modelsCount} />
            <TabButton active={tab === 'consumables'} onClick={() => setTab('consumables')}
              label="Consumables" icon={PackageOpen} count={related?.consumablesCount} />
          </div>
        )}

        {tab === 'details' && (
          <div className="space-y-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="label">Website</label>
              <input className="input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div>
              <label className="label">Support Contact</label>
              <input className="input" value={form.support_contact} onChange={(e) => setForm({ ...form, support_contact: e.target.value })} />
            </div>
          </div>
        )}

        {tab !== 'details' && relatedLoading && (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-brand-600" /></div>
        )}
        {tab === 'assets' && !relatedLoading && related && (
          <RelatedAssetGroups groups={related.groups} totalCount={related.totalCount} onClose={() => setDrawerOpen(false)} />
        )}
        {tab === 'models' && !relatedLoading && related && (
          <VendorModelsRollup models={related.models} />
        )}
        {tab === 'consumables' && !relatedLoading && related && (
          <RelatedConsumableList consumables={related.consumables} onClose={() => setDrawerOpen(false)} />
        )}
      </Drawer>
    </>
  );
}

function TabButton({
  active, onClick, label, icon: Icon, count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ElementType;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-1.5 whitespace-nowrap ${
        active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
      {typeof count === 'number' && <CountBadge value={count} />}
    </button>
  );
}
