import { AssetPage } from '../components/asset/AssetPage';
import { commonAssetColumns } from '../components/asset/columns';
import { otherAssetsApi } from '../api/assets';
import type { OtherAsset } from '../types/assets';
import type { ColumnDef } from '@tanstack/react-table';

interface Extra { host_name: string }
const empty: Extra = { host_name: '' };

const columns: ColumnDef<OtherAsset, any>[] = [
  ...commonAssetColumns<OtherAsset>().slice(0, 4),
  { accessorKey: 'host_name', header: 'Host Name', size: 180, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  ...commonAssetColumns<OtherAsset>().slice(4),
];

export default function OtherAssetsPage() {
  return (
    <AssetPage<OtherAsset, Extra>
      title="Other Assets"
      subtitle="Miscellaneous items"
      resource="other-assets"
      assetType="other_asset"
      api={otherAssetsApi}
      columns={columns}
      stickyColumnIds={['serial_number']}
      emptyExtra={empty}
      extraToPayload={(e) => ({ host_name: e.host_name || null })}
      rowToExtra={(r) => ({ host_name: r.host_name || '' })}
      renderExtraFields={(extra, set) => (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Host Name</label>
            <input className="input" value={extra.host_name} onChange={(e) => set({ host_name: e.target.value })} />
          </div>
        </div>
      )}
    />
  );
}
