import { AssetPage } from '../components/asset/AssetPage';
import { commonAssetColumns } from '../components/asset/columns';
import { ipPhonesApi } from '../api/assets';
import type { IpPhone } from '../types/assets';
import type { ColumnDef } from '@tanstack/react-table';

interface Extra { mac_address: string }
const empty: Extra = { mac_address: '' };

const columns: ColumnDef<IpPhone, any>[] = [
  ...commonAssetColumns<IpPhone>().slice(0, 4),
  { accessorKey: 'mac_address', header: 'MAC', size: 150, cell: (i) => <span className="font-mono text-xs">{i.getValue() as string || '—'}</span> },
  ...commonAssetColumns<IpPhone>().slice(4),
];

export default function IpPhonesPage() {
  return (
    <AssetPage<IpPhone, Extra>
      title="IP Phones"
      subtitle="VoIP desk phones"
      resource="ip-phones"
      assetType="ip_phone"
      api={ipPhonesApi}
      columns={columns}
      stickyColumnIds={['serial_number']}
      emptyExtra={empty}
      extraToPayload={(e) => ({ mac_address: e.mac_address || null })}
      rowToExtra={(r) => ({ mac_address: r.mac_address || '' })}
      renderExtraFields={(extra, set) => (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">MAC Address</label>
            <input
              className="input font-mono"
              value={extra.mac_address}
              onChange={(e) => set({ mac_address: e.target.value })}
              placeholder="00:00:00:00:00:00"
            />
          </div>
        </div>
      )}
    />
  );
}
