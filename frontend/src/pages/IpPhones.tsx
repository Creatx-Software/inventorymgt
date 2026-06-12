import { AssetPage } from '../components/asset/AssetPage';
import type { FilterFieldDef } from '../components/asset/AssetPage';
import { commonAssetColumns } from '../components/asset/columns';
import { ipPhonesApi } from '../api/assets';
import type { IpPhone } from '../types/assets';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle2 } from 'lucide-react';

interface Extra {
  mac_address: string;
  phone_number: string;
  is_recording_enabled: boolean;
}

const empty: Extra = { mac_address: '', phone_number: '', is_recording_enabled: false };

const extraFilterFields: FilterFieldDef[] = [
  {
    key: 'is_recording_enabled',
    label: 'Recording',
    type: 'select',
    options: [
      { value: '1', label: 'Recording On' },
      { value: '0', label: 'Recording Off' },
    ],
  },
  { key: 'phone_number', label: 'Phone Number', type: 'text', placeholder: 'Filter by number…' },
];

const columns: ColumnDef<IpPhone, any>[] = [
  ...commonAssetColumns<IpPhone>().slice(0, 4),
  {
    accessorKey: 'phone_number',
    header: 'Phone Number',
    size: 140,
    cell: (i) => i.getValue()
      ? <span className="font-mono text-xs">{i.getValue() as string}</span>
      : <span className="text-slate-300">—</span>,
  },
  {
    accessorKey: 'mac_address',
    header: 'MAC',
    size: 150,
    cell: (i) => <span className="font-mono text-xs">{i.getValue() as string || '—'}</span>,
  },
  {
    accessorKey: 'is_recording_enabled',
    header: 'Recording',
    size: 100,
    cell: (i) => i.getValue()
      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      : <span className="text-slate-300">—</span>,
  },
  ...commonAssetColumns<IpPhone>().slice(4),
];

export default function IpPhonesPage() {
  return (
    <AssetPage<IpPhone, Extra>
      title="IP Phones"
      subtitle="VoIP desk phones"
      resource="ip-phones"
      assetType="ip_phone"
      extraFilterFields={extraFilterFields}
      api={ipPhonesApi}
      columns={columns}
      stickyColumnIds={['serial_number']}
      emptyExtra={empty}
      extraToPayload={(e) => ({
        mac_address:          e.mac_address          || null,
        phone_number:         e.phone_number         || null,
        is_recording_enabled: e.is_recording_enabled,
      })}
      rowToExtra={(r) => ({
        mac_address:          r.mac_address          || '',
        phone_number:         r.phone_number         || '',
        is_recording_enabled: !!r.is_recording_enabled,
      })}
      renderExtraFields={(extra, set) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone Number</label>
              <input
                className="input font-mono"
                value={extra.phone_number}
                onChange={(e) => set({ ...extra, phone_number: e.target.value })}
                placeholder="+44 20 1234 5678"
              />
            </div>
            <div>
              <label className="label">MAC Address</label>
              <input
                className="input font-mono"
                value={extra.mac_address}
                onChange={(e) => set({ ...extra, mac_address: e.target.value })}
                placeholder="00:00:00:00:00:00"
              />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={extra.is_recording_enabled}
                  onChange={(e) => set({ ...extra, is_recording_enabled: e.target.checked })}
                />
                <div className="w-10 h-5 rounded-full bg-slate-200 peer-checked:bg-emerald-500 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </div>
              <span className="label mb-0">Phone Recording Enabled</span>
            </label>
          </div>
        </div>
      )}
    />
  );
}
