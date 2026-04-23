import { AssetPage } from '../components/asset/AssetPage';
import { commonAssetColumns } from '../components/asset/columns';
import { fmtDate } from '../components/asset/CommonFields';
import { printersApi } from '../api/assets';
import type { Printer } from '../types/assets';
import type { ColumnDef } from '@tanstack/react-table';

interface Extra { device_name: string; host_name: string; ip_address: string; managed_by: string; eol_date: string }
const empty: Extra = { device_name: '', host_name: '', ip_address: '', managed_by: '', eol_date: '' };

const columns: ColumnDef<Printer, any>[] = [
  ...commonAssetColumns<Printer>().slice(0, 2),
  { accessorKey: 'device_name', header: 'Device Name', size: 180, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  ...commonAssetColumns<Printer>().slice(2, 4),
  { accessorKey: 'host_name', header: 'Host', size: 160, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'ip_address', header: 'IP', size: 130, cell: (i) => <span className="font-mono text-xs">{i.getValue() as string || '—'}</span> },
  { accessorKey: 'managed_by', header: 'Managed By', size: 130, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  ...commonAssetColumns<Printer>().slice(4),
  { accessorKey: 'eol_date', header: 'EOL', size: 110, cell: (i) => fmtDate(i.getValue() as string) },
];

export default function PrintersPage() {
  return (
    <AssetPage<Printer, Extra>
      title="Printers"
      subtitle="Print and scan devices"
      resource="printers"
      assetType="printer"
      api={printersApi}
      columns={columns}
      stickyColumnIds={['serial_number']}
      emptyExtra={empty}
      extraToPayload={(e) => ({
        device_name: e.device_name || null, host_name: e.host_name || null,
        ip_address: e.ip_address || null, managed_by: e.managed_by || null,
        eol_date: e.eol_date || null,
      })}
      rowToExtra={(r) => ({
        device_name: r.device_name || '', host_name: r.host_name || '',
        ip_address: r.ip_address || '', managed_by: r.managed_by || '',
        eol_date: r.eol_date ? r.eol_date.slice(0, 10) : '',
      })}
      renderExtraFields={(extra, set, _common) => (
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Device Name</label><input className="input" value={extra.device_name} onChange={(e) => set({ ...extra, device_name: e.target.value })} /></div>
          <div><label className="label">Host Name</label><input className="input" value={extra.host_name} onChange={(e) => set({ ...extra, host_name: e.target.value })} /></div>
          <div><label className="label">IP Address</label><input className="input font-mono" value={extra.ip_address} onChange={(e) => set({ ...extra, ip_address: e.target.value })} /></div>
          <div><label className="label">Managed By</label><input className="input" value={extra.managed_by} onChange={(e) => set({ ...extra, managed_by: e.target.value })} /></div>
          <div><label className="label">EOL Date</label><input type="date" className="input" value={extra.eol_date} onChange={(e) => set({ ...extra, eol_date: e.target.value })} /></div>
        </div>
      )}
    />
  );
}
