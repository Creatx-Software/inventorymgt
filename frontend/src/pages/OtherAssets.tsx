import { useEffect, useMemo, useState } from 'react';
import { AssetPage } from '../components/asset/AssetPage';
import { commonAssetColumns } from '../components/asset/columns';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { otherAssetsApi } from '../api/assets';
import type { OtherAsset } from '../types/assets';
import type { ColumnDef } from '@tanstack/react-table';
import type { ListParams } from '../types/api';
import { Filter, X } from 'lucide-react';

interface Extra { host_name: string }
const empty: Extra = { host_name: '' };

const columns: ColumnDef<OtherAsset, any>[] = [
  ...commonAssetColumns<OtherAsset>().slice(0, 4),
  { accessorKey: 'host_name', header: 'Host Name', size: 180, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  ...commonAssetColumns<OtherAsset>().slice(4),
];

export default function OtherAssetsPage() {
  const [activeName, setActiveName] = useState<string>('');
  const [assetNames, setAssetNames] = useState<{ value: string; label: string; count: number }[]>([]);

  useEffect(() => {
    otherAssetsApi.list({ pageSize: 1000, includeDeleted: false }).then((r) => {
      // Group case-insensitively, keep the most frequent casing as the display label
      const freq: Record<string, { label: string; count: number }> = {};
      for (const a of r.data as OtherAsset[]) {
        if (!a.asset_name) continue;
        const key = a.asset_name.toLowerCase();
        if (!freq[key]) freq[key] = { label: a.asset_name, count: 0 };
        freq[key].count++;
      }
      const names = Object.entries(freq)
        .map(([value, { label, count }]) => ({ value, label, count }))
        .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
      setAssetNames(names);
    }).catch(() => {});
  }, []);

  const filteredApi = useMemo(() => ({
    ...otherAssetsApi,
    list: (p: ListParams) => otherAssetsApi.list({
      ...p,
      filters: {
        ...p.filters,
        ...(activeName ? { asset_name: activeName } : {}),
      },
    }),
  }), [activeName]);

  return (
    <div className="space-y-3">
      {/* Asset-name filter — compact searchable dropdown */}
      {assetNames.length > 0 && (
        <div className="card p-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Filter by name
          </div>
          <div className="w-80">
            <SearchableSelect
              value={activeName}
              onChange={setActiveName}
              options={assetNames.map((n) => ({ value: n.value, label: n.label, sublabel: `${n.count} item${n.count === 1 ? '' : 's'}` }))}
              emptyOption="All items"
              placeholder="All items"
            />
          </div>
          {activeName && (
            <button
              onClick={() => setActiveName('')}
              className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear filter
            </button>
          )}
          <span className="ml-auto text-xs text-slate-500">
            {assetNames.length} distinct name{assetNames.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      <AssetPage<OtherAsset, Extra>
        title="Other Assets"
        subtitle={activeName ? `Filtered by: ${assetNames.find((n) => n.value === activeName)?.label}` : 'Miscellaneous items'}
        resource="other-assets"
        assetType="other_asset"
        api={filteredApi}
        columns={columns}
        stickyColumnIds={['serial_number']}
        emptyExtra={empty}
        extraToPayload={(e) => ({ host_name: e.host_name || null })}
        rowToExtra={(r) => ({ host_name: r.host_name || '' })}
        renderExtraFields={(extra, set, _common) => (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Host Name</label>
              <input className="input" value={extra.host_name} onChange={(e) => set({ host_name: e.target.value })} />
            </div>
          </div>
        )}
      />
    </div>
  );
}
