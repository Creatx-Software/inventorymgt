import { AssetPage } from '../components/asset/AssetPage';
import { commonAssetColumns } from '../components/asset/columns';
import { fmtDate } from '../components/asset/CommonFields';
import { endpointsApi } from '../api/assets';
import type { Endpoint } from '../types/assets';
import type { ColumnDef } from '@tanstack/react-table';

interface Extra {
  endpoint_type: 'Laptop' | 'Desktop' | 'Scanner' | 'Other';
  host_name: string;
  asset_code: string;
  mac_address: string;
  os_name_version: string;
  ip_address: string;
  is_under_warranty: boolean;
  warranty_expiry_date: string;
  eol_date: string;
}

const empty: Extra = {
  endpoint_type: 'Laptop', host_name: '', asset_code: '', mac_address: '',
  os_name_version: '', ip_address: '', is_under_warranty: false,
  warranty_expiry_date: '', eol_date: '',
};

const columns: ColumnDef<Endpoint, any>[] = [
  ...commonAssetColumns<Endpoint>().slice(0, 2),
  { accessorKey: 'endpoint_type', header: 'Type', size: 100 },
  ...commonAssetColumns<Endpoint>().slice(2, 4),
  { accessorKey: 'host_name', header: 'Host', size: 160, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'asset_code', header: 'Asset Code', size: 160, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'mac_address', header: 'MAC', size: 150, cell: (i) => <span className="font-mono text-xs">{i.getValue() as string || '—'}</span> },
  { accessorKey: 'ip_address', header: 'IP', size: 130, cell: (i) => <span className="font-mono text-xs">{i.getValue() as string || '—'}</span> },
  { accessorKey: 'os_name_version', header: 'OS', size: 200, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  ...commonAssetColumns<Endpoint>().slice(4),
  { accessorKey: 'warranty_expiry_date', header: 'Warranty Expiry', size: 130, cell: (i) => fmtDate(i.getValue() as string) },
  { accessorKey: 'eol_date', header: 'EOL', size: 110, cell: (i) => fmtDate(i.getValue() as string) },
];

export default function EndpointsPage() {
  return (
    <AssetPage<Endpoint, Extra>
      title="Endpoints"
      subtitle="Laptops, desktops, scanners"
      resource="endpoints"
      assetType="endpoint"
      api={endpointsApi}
      columns={columns}
      stickyColumnIds={['serial_number']}
      emptyExtra={empty}
      extraToPayload={(e) => ({
        endpoint_type: e.endpoint_type,
        host_name: e.host_name || null,
        asset_code: e.asset_code || null,
        mac_address: e.mac_address || null,
        os_name_version: e.os_name_version || null,
        ip_address: e.ip_address || null,
        is_under_warranty: e.is_under_warranty,
        warranty_expiry_date: e.warranty_expiry_date || null,
        eol_date: e.eol_date || null,
      })}
      rowToExtra={(r) => ({
        endpoint_type: r.endpoint_type,
        host_name: r.host_name || '',
        asset_code: r.asset_code || '',
        mac_address: r.mac_address || '',
        os_name_version: r.os_name_version || '',
        ip_address: r.ip_address || '',
        is_under_warranty: r.is_under_warranty,
        warranty_expiry_date: r.warranty_expiry_date ? r.warranty_expiry_date.slice(0, 10) : '',
        eol_date: r.eol_date ? r.eol_date.slice(0, 10) : '',
      })}
      renderExtraFields={(extra, set) => (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Type</label>
            <select className="input" value={extra.endpoint_type} onChange={(e) => set({ ...extra, endpoint_type: e.target.value as any })}>
              <option>Laptop</option><option>Desktop</option><option>Scanner</option><option>Other</option>
            </select>
          </div>
          <div>
            <label className="label">Host Name</label>
            <input className="input" value={extra.host_name} onChange={(e) => set({ ...extra, host_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Asset Code</label>
            <input className="input" value={extra.asset_code} onChange={(e) => set({ ...extra, asset_code: e.target.value })} />
          </div>
          <div>
            <label className="label">MAC Address</label>
            <input className="input font-mono" value={extra.mac_address} onChange={(e) => set({ ...extra, mac_address: e.target.value })} />
          </div>
          <div>
            <label className="label">IP Address</label>
            <input className="input font-mono" value={extra.ip_address} onChange={(e) => set({ ...extra, ip_address: e.target.value })} />
          </div>
          <div>
            <label className="label">OS Name & Version</label>
            <input className="input" value={extra.os_name_version} onChange={(e) => set({ ...extra, os_name_version: e.target.value })} />
          </div>
          <div>
            <label className="label">Warranty Expiry</label>
            <input type="date" className="input" value={extra.warranty_expiry_date} onChange={(e) => set({ ...extra, warranty_expiry_date: e.target.value })} />
          </div>
          <div>
            <label className="label">EOL Date</label>
            <input type="date" className="input" value={extra.eol_date} onChange={(e) => set({ ...extra, eol_date: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600"
                checked={extra.is_under_warranty} onChange={(e) => set({ ...extra, is_under_warranty: e.target.checked })} />
              Currently under warranty / AMC
            </label>
          </div>
        </div>
      )}
    />
  );
}
