import { AssetPage } from '../components/asset/AssetPage';
import { commonAssetColumns } from '../components/asset/columns';
import { mobileDevicesApi } from '../api/assets';
import type { MobileDevice } from '../types/assets';
import type { ColumnDef } from '@tanstack/react-table';

interface Extra {
  eid: string; mobile_number: string; sim_number: string; imei_number: string; production_year: string;
}
const empty: Extra = { eid: '', mobile_number: '', sim_number: '', imei_number: '', production_year: '' };

const columns: ColumnDef<MobileDevice, any>[] = [
  ...commonAssetColumns<MobileDevice>().slice(0, 4),
  { accessorKey: 'mobile_number', header: 'Mobile #', size: 150, cell: (i) => <span className="font-mono text-xs">{i.getValue() as string || '—'}</span> },
  { accessorKey: 'imei_number', header: 'IMEI', size: 160, cell: (i) => <span className="font-mono text-xs">{i.getValue() as string || '—'}</span> },
  { accessorKey: 'sim_number', header: 'SIM #', size: 150, cell: (i) => <span className="font-mono text-xs">{i.getValue() as string || '—'}</span> },
  { accessorKey: 'production_year', header: 'Year', size: 90, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  ...commonAssetColumns<MobileDevice>().slice(4),
];

export default function MobileDevicesPage() {
  return (
    <AssetPage<MobileDevice, Extra>
      title="Mobile Devices"
      subtitle="Phones and tablets"
      resource="mobile-devices"
      assetType="mobile_device"
      api={mobileDevicesApi}
      columns={columns}
      stickyColumnIds={['serial_number']}
      emptyExtra={empty}
      extraToPayload={(e) => ({
        eid: e.eid || null,
        mobile_number: e.mobile_number || null,
        sim_number: e.sim_number || null,
        imei_number: e.imei_number || null,
        production_year: e.production_year ? Number(e.production_year) : null,
      })}
      rowToExtra={(r) => ({
        eid: r.eid || '',
        mobile_number: r.mobile_number || '',
        sim_number: r.sim_number || '',
        imei_number: r.imei_number || '',
        production_year: r.production_year ? String(r.production_year) : '',
      })}
      renderExtraFields={(extra, set) => (
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">EID</label><input className="input font-mono" value={extra.eid} onChange={(e) => set({ ...extra, eid: e.target.value })} /></div>
          <div><label className="label">Mobile Number</label><input className="input font-mono" value={extra.mobile_number} onChange={(e) => set({ ...extra, mobile_number: e.target.value })} /></div>
          <div><label className="label">SIM Number</label><input className="input font-mono" value={extra.sim_number} onChange={(e) => set({ ...extra, sim_number: e.target.value })} /></div>
          <div><label className="label">IMEI Number</label><input className="input font-mono" value={extra.imei_number} onChange={(e) => set({ ...extra, imei_number: e.target.value })} /></div>
          <div><label className="label">Production Year</label><input type="number" className="input" value={extra.production_year} onChange={(e) => set({ ...extra, production_year: e.target.value })} /></div>
        </div>
      )}
    />
  );
}
