import { useState } from 'react';
import { AssetPage } from '../components/asset/AssetPage';
import { commonAssetColumns } from '../components/asset/columns';
import { fmtDate } from '../components/asset/CommonFields';
import { networkDevicesApi } from '../api/assets';
import type { NetworkDevice } from '../types/assets';
import type { ColumnDef } from '@tanstack/react-table';
import { RotateCcw } from 'lucide-react';

interface Extra {
  device_name: string; host_name: string; ip_address: string; asset_code: string;
  managed_by: string; warranty_expiry_date: string; eol_date: string;
}
const empty: Extra = {
  device_name: '', host_name: '', ip_address: '', asset_code: '',
  managed_by: '', warranty_expiry_date: '', eol_date: '',
};

const columns: ColumnDef<NetworkDevice, any>[] = [
  ...commonAssetColumns<NetworkDevice>().slice(0, 2),
  { accessorKey: 'device_name', header: 'Device Name', size: 200, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  ...commonAssetColumns<NetworkDevice>().slice(2, 4),
  { accessorKey: 'host_name', header: 'Host', size: 160, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'ip_address', header: 'IP', size: 130, cell: (i) => <span className="font-mono text-xs">{i.getValue() as string || '—'}</span> },
  { accessorKey: 'managed_by', header: 'Managed By', size: 130, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  ...commonAssetColumns<NetworkDevice>().slice(4),
  { accessorKey: 'eol_date', header: 'EOL', size: 110, cell: (i) => fmtDate(i.getValue() as string) },
];

const decomApi = {
  ...networkDevicesApi,
  list: (p: any) => networkDevicesApi.list({ ...p, decommissioned: true }),
};

export default function DeinductedNetworkDevicesPage() {
  const [restoring, setRestoring] = useState(false);
  return (
    <AssetPage<NetworkDevice, Extra>
      title="Deinducted Network Devices"
      subtitle="Network devices removed from active service"
      resource="network-devices"
      assetType="network_device"
      api={decomApi as any}
      columns={columns}
      stickyColumnIds={['serial_number']}
      emptyExtra={empty}
      extraDrawerFooter={(row, reload, close) => (
        <button
          disabled={restoring}
          onClick={async () => {
            if (!confirm(`Restore "${row.serial_number}" back to active Network Devices?`)) return;
            setRestoring(true);
            try { await networkDevicesApi.restoreDeinduct(row.id); reload(); close(); }
            finally { setRestoring(false); }
          }}
          className="btn bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
        >
          <RotateCcw className="w-4 h-4" /> Restore to Active
        </button>
      )}
      extraToPayload={(e) => ({
        device_name: e.device_name || null, host_name: e.host_name || null,
        ip_address: e.ip_address || null, asset_code: e.asset_code || null,
        managed_by: e.managed_by || null,
        warranty_expiry_date: e.warranty_expiry_date || null,
        eol_date: e.eol_date || null,
      })}
      rowToExtra={(r) => ({
        device_name: r.device_name || '', host_name: r.host_name || '',
        ip_address: r.ip_address || '', asset_code: r.asset_code || '',
        managed_by: r.managed_by || '',
        warranty_expiry_date: r.warranty_expiry_date ? r.warranty_expiry_date.slice(0, 10) : '',
        eol_date: r.eol_date ? r.eol_date.slice(0, 10) : '',
      })}
      renderExtraFields={(extra, set, _common) => (
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Device Name</label><input className="input" value={extra.device_name} onChange={(e) => set({ ...extra, device_name: e.target.value })} /></div>
          <div><label className="label">Host Name</label><input className="input" value={extra.host_name} onChange={(e) => set({ ...extra, host_name: e.target.value })} /></div>
          <div><label className="label">IP Address</label><input className="input font-mono" value={extra.ip_address} onChange={(e) => set({ ...extra, ip_address: e.target.value })} /></div>
          <div><label className="label">Asset Code</label><input className="input" value={extra.asset_code} onChange={(e) => set({ ...extra, asset_code: e.target.value })} /></div>
          <div><label className="label">Managed By</label><input className="input" value={extra.managed_by} onChange={(e) => set({ ...extra, managed_by: e.target.value })} /></div>
          <div><label className="label">Warranty Expiry</label><input type="date" className="input" value={extra.warranty_expiry_date} onChange={(e) => set({ ...extra, warranty_expiry_date: e.target.value })} /></div>
          <div><label className="label">EOL Date</label><input type="date" className="input" value={extra.eol_date} onChange={(e) => set({ ...extra, eol_date: e.target.value })} /></div>
        </div>
      )}
    />
  );
}
