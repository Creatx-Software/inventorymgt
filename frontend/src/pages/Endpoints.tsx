import { useEffect, useMemo, useState } from 'react';
import { AssetPage } from '../components/asset/AssetPage';
import { commonAssetColumns } from '../components/asset/columns';
import { fmtDate, StatusBadge } from '../components/asset/CommonFields';
import { endpointsApi, assetStatusesApi } from '../api/assets';
import type { Endpoint, AssetStatus } from '../types/assets';
import type { ColumnDef } from '@tanstack/react-table';
import type { ListParams } from '../types/api';
import clsx from 'clsx';

// PO format: PO/ICICIUK/DD/MM/YYYY/...
// EOL = purchase date + 5 years
function parseEolFromPo(po: string): string | null {
  const m = po.match(/^PO\/[^/]+\/(\d{2})\/(\d{2})\/(\d{4})\//i);
  if (!m) return null;
  const [, day, month, year] = m;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (isNaN(date.getTime())) return null;
  date.setFullYear(date.getFullYear() + 5);
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

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
  { accessorKey: 'host_name', header: 'Host', size: 160, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  ...commonAssetColumns<Endpoint>().slice(0, 2),
  { accessorKey: 'endpoint_type', header: 'Type', size: 100 },
  ...commonAssetColumns<Endpoint>().slice(2, 4),
  { accessorKey: 'asset_code', header: 'Asset Code', size: 160, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'mac_address', header: 'MAC', size: 150, cell: (i) => <span className="font-mono text-xs">{i.getValue() as string || '—'}</span> },
  { accessorKey: 'ip_address', header: 'IP', size: 130, cell: (i) => <span className="font-mono text-xs">{i.getValue() as string || '—'}</span> },
  { accessorKey: 'os_name_version', header: 'OS', size: 200, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'status_name', header: 'Status', size: 120, enableSorting: true,
    cell: (i) => <StatusBadge name={i.row.original.status_name} color={i.row.original.status_color} /> },
  ...commonAssetColumns<Endpoint>().slice(5),
  { accessorKey: 'warranty_expiry_date', header: 'Warranty Expiry', size: 130, cell: (i) => fmtDate(i.getValue() as string) },
  { accessorKey: 'eol_date', header: 'EOL', size: 110, cell: (i) => fmtDate(i.getValue() as string) },
];

export default function EndpointsPage() {
  const [statuses, setStatuses] = useState<AssetStatus[]>([]);
  const [activeStatus, setActiveStatus] = useState<AssetStatus | null>(null);

  useEffect(() => {
    assetStatusesApi.list().then(setStatuses).catch(() => {});
  }, []);

  const filteredApi = useMemo(() => ({
    ...endpointsApi,
    list: (p: ListParams) => endpointsApi.list({
      ...p,
      filters: {
        ...p.filters,
        ...(activeStatus ? { status_id: String(activeStatus.id) } : {}),
      },
    }),
  }), [activeStatus]);

  return (
    <div className="space-y-3">
      {/* Status tabs */}
      {statuses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveStatus(null)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition border',
              activeStatus === null
                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            All
          </button>
          {statuses.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStatus(s)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition border',
                activeStatus?.id === s.id
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
              style={activeStatus?.id === s.id
                ? { backgroundColor: s.color, borderColor: s.color }
                : { borderLeftColor: s.color, borderLeftWidth: 3 }
              }
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <AssetPage<Endpoint, Extra>
        title="Endpoints"
        subtitle={activeStatus ? `Filtered: ${activeStatus.name}` : 'Laptops, desktops, scanners'}
        resource="endpoints"
        assetType="endpoint"
        api={filteredApi}
        columns={columns}
        stickyColumnIds={['host_name']}
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
        renderExtraFields={(extra, set, common) => {
          const calculatedEol = parseEolFromPo(common.po_number || '');
          const eolMismatch = calculatedEol && extra.eol_date && extra.eol_date !== calculatedEol;
          return (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Type</label>
                <select className="input" value={extra.endpoint_type} onChange={(e) => set({ ...extra, endpoint_type: e.target.value as any })}>
                  <option>Laptop</option><option>Desktop</option><option>Other</option>
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
                <label className="label flex items-center gap-2">
                  EOL Date
                  {calculatedEol && (
                    <button
                      type="button"
                      onClick={() => set({ ...extra, eol_date: calculatedEol })}
                      className="text-[11px] font-normal text-brand-600 hover:underline"
                      title="Auto-calculated from PO number (purchase date + 5 years)"
                    >
                      {eolMismatch ? '⚠ Set from PO' : extra.eol_date ? '✓ From PO' : 'Set from PO →'}
                    </button>
                  )}
                </label>
                <input
                  type="date"
                  className="input"
                  value={extra.eol_date}
                  onChange={(e) => set({ ...extra, eol_date: e.target.value })}
                  placeholder={calculatedEol || ''}
                />
                {calculatedEol && !extra.eol_date && (
                  <div className="text-xs text-slate-400 mt-1">
                    Calculated: {new Date(calculatedEol).toLocaleDateString('en-GB')} (PO date + 5 yrs)
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    checked={extra.is_under_warranty} onChange={(e) => set({ ...extra, is_under_warranty: e.target.checked })} />
                  Currently under warranty / AMC
                </label>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
