import { AssetPage } from '../components/asset/AssetPage';
import { commonAssetColumns } from '../components/asset/columns';
import { fmtDate, StatusBadge } from '../components/asset/CommonFields';
import { endpointsApi } from '../api/assets';
import type { Endpoint } from '../types/assets';
import type { ColumnDef } from '@tanstack/react-table';
import { SearchableSelect } from '../components/ui/SearchableSelect';

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
  data_wiped: boolean;
  data_wiped_by: string;
  data_checked_by: string;
}

const empty: Extra = {
  endpoint_type: 'Laptop', host_name: '', asset_code: '', mac_address: '',
  os_name_version: '', ip_address: '', is_under_warranty: false,
  warranty_expiry_date: '', eol_date: '', data_wiped: false, data_wiped_by: '', data_checked_by: '',
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
  {
    accessorKey: 'data_wiped', header: 'Data Wiped', size: 160,
    cell: (i) => i.getValue() ? (
      <div>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700">Wiped</span>
        {i.row.original.data_wiped_by && (
          <div className="text-xs text-slate-500 mt-0.5 truncate">W: {i.row.original.data_wiped_by}</div>
        )}
        {i.row.original.data_checked_by && (
          <div className="text-xs text-slate-500 mt-0.5 truncate">C: {i.row.original.data_checked_by}</div>
        )}
      </div>
    ) : <span className="text-slate-300">—</span>,
  },
];

export default function EndpointsPage() {
  return (
    <>
      <AssetPage<Endpoint, Extra>
        title="Endpoints"
        subtitle="Laptops, desktops, scanners"
        resource="endpoints"
        assetType="endpoint"
        api={endpointsApi}
        columns={columns}
        stickyColumnIds={['host_name']}
        defaultSorting={[{ id: 'host_name', desc: false }]}
        extraFilterFields={[
          { key: 'endpoint_type', label: 'Type', type: 'select', options: [
            { value: 'Laptop',  label: 'Laptop'  },
            { value: 'Desktop', label: 'Desktop' },
            { value: 'Other',   label: 'Other'   },
          ]},
          { key: 'host_name',  label: 'Host Name',  type: 'text', placeholder: 'Filter by host…' },
          { key: 'ip_address', label: 'IP Address',  type: 'text', placeholder: 'Filter by IP…'   },
        ]}
        emptyExtra={empty}
        extraToPayload={(e, common) => {
          const statusName = (common as any).statusName ?? '';
          // Only persist wipe data when In Stores; clear it otherwise
          const inStores = statusName === 'In Stores';
          return {
            endpoint_type: e.endpoint_type,
            host_name: e.host_name || null,
            asset_code: e.asset_code || null,
            mac_address: e.mac_address || null,
            os_name_version: e.os_name_version || null,
            ip_address: e.ip_address || null,
            is_under_warranty: e.is_under_warranty,
            warranty_expiry_date: e.warranty_expiry_date || null,
            eol_date: e.eol_date || null,
            data_wiped: inStores ? e.data_wiped : false,
            data_wiped_by: (inStores && e.data_wiped) ? (e.data_wiped_by || null) : null,
            data_checked_by: (inStores && e.data_wiped) ? (e.data_checked_by || null) : null,
          };
        }}
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
          data_wiped: r.data_wiped ?? false,
          data_wiped_by: r.data_wiped_by || '',
          data_checked_by: r.data_checked_by || '',
        })}
        renderExtraFields={(extra, set, common, statuses) => {
          const calculatedEol = parseEolFromPo(common.po_number || '');
          const eolMismatch = calculatedEol && extra.eol_date && extra.eol_date !== calculatedEol;
          const isInStores = statuses.find((s) => String(s.id) === common.status_id)?.name === 'In Stores';
          return (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Type</label>
                <SearchableSelect
                  value={extra.endpoint_type}
                  onChange={(v) => set({ ...extra, endpoint_type: (v || 'Laptop') as any })}
                  options={['Laptop','Desktop','Other'].map((x) => ({ value: x, label: x }))}
                  emptyOption={null}
                />
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
              {isInStores && (
                <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                      checked={extra.data_wiped}
                      onChange={(e) => set({ ...extra, data_wiped: e.target.checked, data_wiped_by: e.target.checked ? extra.data_wiped_by : '', data_checked_by: e.target.checked ? extra.data_checked_by : '' })}
                    />
                    Data Wiped
                  </label>
                  {extra.data_wiped && (
                    <>
                      <div>
                        <label className="label">Wiped by (person's name)</label>
                        <input
                          className="input"
                          value={extra.data_wiped_by}
                          onChange={(e) => set({ ...extra, data_wiped_by: e.target.value })}
                          placeholder="Enter the name of the person who wiped the data"
                        />
                      </div>
                      <div>
                        <label className="label">Checked by (person's name)</label>
                        <input
                          className="input"
                          value={extra.data_checked_by}
                          onChange={(e) => set({ ...extra, data_checked_by: e.target.value })}
                          placeholder="Enter the name of the person who checked the wipe"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        }}
      />
    </>
  );
}
