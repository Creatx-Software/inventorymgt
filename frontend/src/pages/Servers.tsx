import { AssetPage } from '../components/asset/AssetPage';
import { commonAssetColumns } from '../components/asset/columns';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { fmtDate } from '../components/asset/CommonFields';
import { serversApi } from '../api/assets';
import type { Server } from '../types/assets';
import type { ColumnDef } from '@tanstack/react-table';

interface Extra {
  application_name: string; can_id: string;
  application_tier: '' | '0' | '1' | '2' | '3' | '4';
  server_class: '' | 'Physical' | 'Virtual';
  server_type: '' | 'Web' | 'App' | 'DB' | 'Other';
  environment: '' | 'Prod' | 'FB' | 'DR';
  os_name_version: string; server_software: string; managed_by: string;
  ip_address: string; host_name: string; asset_code: string; dc_location: string;
  is_under_warranty: boolean; warranty_expiry_date: string; eol_date: string;
  hardening_status: boolean; patching_status: boolean; exception_memo_no: string;
}

const empty: Extra = {
  application_name: '', can_id: '',
  application_tier: '', server_class: '', server_type: '', environment: '',
  os_name_version: '', server_software: '', managed_by: '',
  ip_address: '', host_name: '', asset_code: '', dc_location: '',
  is_under_warranty: false, warranty_expiry_date: '', eol_date: '',
  hardening_status: false, patching_status: false, exception_memo_no: '',
};

const envBadge = (v: string | null) => {
  if (!v) return <span className="text-slate-300">—</span>;
  const colors: any = {
    Prod: 'bg-red-50 text-red-700 border-red-200',
    FB: 'bg-amber-50 text-amber-700 border-amber-200',
    DR: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${colors[v]}`}>{v}</span>;
};

const columns: ColumnDef<Server, any>[] = [
  ...commonAssetColumns<Server>().slice(0, 2),
  { accessorKey: 'application_name', header: 'Application', size: 200, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'environment', header: 'Env', size: 90, cell: (i) => envBadge(i.getValue() as string | null) },
  { accessorKey: 'application_tier', header: 'Tier', size: 80, cell: (i) => i.getValue() ?? <span className="text-slate-300">—</span> },
  { accessorKey: 'server_class', header: 'Class', size: 100, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'server_type', header: 'Type', size: 90, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  ...commonAssetColumns<Server>().slice(2, 4),
  { accessorKey: 'host_name', header: 'Host', size: 160, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'ip_address', header: 'IP', size: 130, cell: (i) => <span className="font-mono text-xs">{i.getValue() as string || '—'}</span> },
  { accessorKey: 'os_name_version', header: 'OS', size: 200, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'server_software', header: 'Software', size: 180, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'managed_by', header: 'Managed By', size: 130, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  { accessorKey: 'dc_location', header: 'DC', size: 130, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
  ...commonAssetColumns<Server>().slice(4),
  { accessorKey: 'warranty_expiry_date', header: 'Warranty Expiry', size: 130, cell: (i) => fmtDate(i.getValue() as string) },
  { accessorKey: 'eol_date', header: 'EOL', size: 110, cell: (i) => fmtDate(i.getValue() as string) },
  { accessorKey: 'hardening_status', header: 'Hardened', size: 100, cell: (i) => i.getValue()
    ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span> },
  { accessorKey: 'patching_status', header: 'Patched', size: 100, cell: (i) => i.getValue()
    ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span> },
];

export default function ServersPage() {
  return (
    <AssetPage<Server, Extra>
      title="Servers"
      subtitle="Physical and virtual servers"
      resource="servers"
      assetType="server"
      api={serversApi}
      columns={columns}
      stickyColumnIds={['serial_number']}
      emptyExtra={empty}
      extraToPayload={(e) => ({
        application_name: e.application_name || null,
        can_id: e.can_id || null,
        application_tier: e.application_tier || null,
        server_class: e.server_class || null,
        server_type: e.server_type || null,
        environment: e.environment || null,
        os_name_version: e.os_name_version || null,
        server_software: e.server_software || null,
        managed_by: e.managed_by || null,
        ip_address: e.ip_address || null,
        host_name: e.host_name || null,
        asset_code: e.asset_code || null,
        dc_location: e.dc_location || null,
        is_under_warranty: e.is_under_warranty,
        warranty_expiry_date: e.warranty_expiry_date || null,
        eol_date: e.eol_date || null,
        hardening_status: e.hardening_status,
        patching_status: e.patching_status,
        exception_memo_no: e.exception_memo_no || null,
      })}
      rowToExtra={(r) => ({
        application_name: r.application_name || '',
        can_id: r.can_id || '',
        application_tier: (r.application_tier || '') as Extra['application_tier'],
        server_class: (r.server_class || '') as Extra['server_class'],
        server_type: (r.server_type || '') as Extra['server_type'],
        environment: (r.environment || '') as Extra['environment'],
        os_name_version: r.os_name_version || '',
        server_software: r.server_software || '',
        managed_by: r.managed_by || '',
        ip_address: r.ip_address || '',
        host_name: r.host_name || '',
        asset_code: r.asset_code || '',
        dc_location: r.dc_location || '',
        is_under_warranty: r.is_under_warranty,
        warranty_expiry_date: r.warranty_expiry_date ? r.warranty_expiry_date.slice(0, 10) : '',
        eol_date: r.eol_date ? r.eol_date.slice(0, 10) : '',
        hardening_status: r.hardening_status,
        patching_status: r.patching_status,
        exception_memo_no: r.exception_memo_no || '',
      })}
      renderExtraFields={(extra, set, _common) => (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Application Name</label><input className="input" value={extra.application_name} onChange={(e) => set({ ...extra, application_name: e.target.value })} /></div>
          <div><label className="label">CAN ID</label><input className="input" value={extra.can_id} onChange={(e) => set({ ...extra, can_id: e.target.value })} /></div>
          <div><label className="label">Application Tier</label>
            <SearchableSelect
              value={extra.application_tier}
              onChange={(v) => set({ ...extra, application_tier: v as any })}
              options={['0','1','2','3','4'].map((x) => ({ value: x, label: x }))}
            />
          </div>
          <div><label className="label">Server Class</label>
            <SearchableSelect
              value={extra.server_class}
              onChange={(v) => set({ ...extra, server_class: v as any })}
              options={[{ value: 'Physical', label: 'Physical' }, { value: 'Virtual', label: 'Virtual' }]}
            />
          </div>
          <div><label className="label">Server Type</label>
            <SearchableSelect
              value={extra.server_type}
              onChange={(v) => set({ ...extra, server_type: v as any })}
              options={['Web','App','DB','Other'].map((x) => ({ value: x, label: x }))}
            />
          </div>
          <div><label className="label">Environment</label>
            <SearchableSelect
              value={extra.environment}
              onChange={(v) => set({ ...extra, environment: v as any })}
              options={['Prod','FB','DR'].map((x) => ({ value: x, label: x }))}
            />
          </div>
          <div><label className="label">Managed By</label><input className="input" value={extra.managed_by} onChange={(e) => set({ ...extra, managed_by: e.target.value })} /></div>
          <div><label className="label">OS Name & Version</label><input className="input" value={extra.os_name_version} onChange={(e) => set({ ...extra, os_name_version: e.target.value })} /></div>
          <div><label className="label">Server Software</label><input className="input" value={extra.server_software} onChange={(e) => set({ ...extra, server_software: e.target.value })} /></div>
          <div><label className="label">Host Name</label><input className="input" value={extra.host_name} onChange={(e) => set({ ...extra, host_name: e.target.value })} /></div>
          <div><label className="label">IP Address</label><input className="input font-mono" value={extra.ip_address} onChange={(e) => set({ ...extra, ip_address: e.target.value })} /></div>
          <div><label className="label">Asset Code</label><input className="input" value={extra.asset_code} onChange={(e) => set({ ...extra, asset_code: e.target.value })} /></div>
          <div><label className="label">DC Location</label><input className="input" value={extra.dc_location} onChange={(e) => set({ ...extra, dc_location: e.target.value })} /></div>
          <div><label className="label">Warranty Expiry</label><input type="date" className="input" value={extra.warranty_expiry_date} onChange={(e) => set({ ...extra, warranty_expiry_date: e.target.value })} /></div>
          <div><label className="label">EOL Date</label><input type="date" className="input" value={extra.eol_date} onChange={(e) => set({ ...extra, eol_date: e.target.value })} /></div>
          <div className="col-span-2"><label className="label">Exception Memo #</label><input className="input" value={extra.exception_memo_no} onChange={(e) => set({ ...extra, exception_memo_no: e.target.value })} /></div>
          <div className="col-span-2 flex flex-wrap gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={extra.is_under_warranty} onChange={(e) => set({ ...extra, is_under_warranty: e.target.checked })} />
              Under warranty
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={extra.hardening_status} onChange={(e) => set({ ...extra, hardening_status: e.target.checked })} />
              Hardened
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={extra.patching_status} onChange={(e) => set({ ...extra, patching_status: e.target.checked })} />
              Patched
            </label>
          </div>
        </div>
      )}
    />
  );
}
