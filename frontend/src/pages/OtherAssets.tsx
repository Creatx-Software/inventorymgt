import { useEffect, useMemo, useState } from 'react';
import { AssetPage } from '../components/asset/AssetPage';
import { commonAssetColumns } from '../components/asset/columns';
import { otherAssetsApi } from '../api/assets';
import type { OtherAsset } from '../types/assets';
import type { ColumnDef } from '@tanstack/react-table';
import type { ListParams } from '../types/api';
import clsx from 'clsx';

interface Extra { host_name: string }
const empty: Extra = { host_name: '' };

const columns: ColumnDef<OtherAsset, any>[] = [
  ...commonAssetColumns<OtherAsset>().slice(0, 4),
  { accessorKey: 'host_name', header: 'Host Name', size: 180, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  ...commonAssetColumns<OtherAsset>().slice(4),
];

export default function OtherAssetsPage() {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [assetNames, setAssetNames] = useState<string[]>([]);

  useEffect(() => {
    otherAssetsApi.list({ pageSize: 1000, includeDeleted: false }).then((r) => {
      // Group case-insensitively, keep the most frequent casing as the display label
      const freq: Record<string, Record<string, number>> = {};
      for (const a of r.data as OtherAsset[]) {
        if (!a.asset_name) continue;
        const key = a.asset_name.toLowerCase();
        if (!freq[key]) freq[key] = {};
        freq[key][a.asset_name] = (freq[key][a.asset_name] || 0) + 1;
      }
      const names = Object.values(freq)
        .map((variants) => Object.entries(variants).sort((a, b) => b[1] - a[1])[0][0])
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      setAssetNames(names);
    }).catch(() => {});
  }, []);

  const filteredApi = useMemo(() => ({
    ...otherAssetsApi,
    list: (p: ListParams) => otherAssetsApi.list({
      ...p,
      filters: {
        ...p.filters,
        ...(activeTab ? { asset_name: activeTab.toLowerCase() } : {}),
      },
    }),
  }), [activeTab]);

  return (
    <div className="space-y-3">
      {/* Name tabs */}
      {assetNames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab(null)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition',
              activeTab === null
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            All
          </button>
          {assetNames.map((name) => (
            <button
              key={name}
              onClick={() => setActiveTab(name)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition',
                activeTab === name
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <AssetPage<OtherAsset, Extra>
        title="Other Assets"
        subtitle={activeTab ? `Filtered by: ${activeTab}` : 'Miscellaneous items'}
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
