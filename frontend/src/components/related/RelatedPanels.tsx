import { useNavigate } from 'react-router-dom';
import {
  Laptop, Monitor, Smartphone, Phone, Server, Printer, Network, Package,
  ExternalLink, User as UserIcon, Mail, MapPin, PackageOpen,
} from 'lucide-react';

export const typeIcons: Record<string, any> = {
  endpoint: Laptop, monitor: Monitor, mobile_device: Smartphone, ip_phone: Phone,
  server: Server, printer: Printer, network_device: Network, other_asset: Package,
};

export const typeRoutes: Record<string, string> = {
  endpoint: '/endpoints', monitor: '/monitors', mobile_device: '/mobile-devices', ip_phone: '/ip-phones',
  server: '/servers', printer: '/printers', network_device: '/network-devices', other_asset: '/other-assets',
};

export interface RelatedAsset {
  id: number;
  serial_number: string;
  asset_name: string | null;
  model: string | null;
  status_name: string | null;
  status_color: string | null;
}

export interface RelatedAssetGroup {
  key: string;
  label: string;
  count: number;
  assets: RelatedAsset[];
}

export interface RelatedEmployee {
  id: number;
  full_name: string;
  employee_code: string | null;
  email: string | null;
  is_active: boolean;
  location_name?: string | null;
  department_name?: string | null;
}

export interface RelatedConsumable {
  id: number;
  name: string;
  category: string | null;
  unit: string;
  current_stock: number;
  minimum_stock: number | null;
}

export interface VendorModelRow {
  asset_type: string;
  asset_label: string;
  model: string;
  count: number;
}

export function RelatedAssetGroups({
  groups, totalCount, onClose,
}: { groups: RelatedAssetGroup[]; totalCount: number; onClose: () => void }) {
  const navigate = useNavigate();
  if (totalCount === 0) {
    return <div className="text-center text-sm text-slate-400 py-12">No assets linked.</div>;
  }
  return (
    <div>
      {groups.map((group) => {
        const Icon = typeIcons[group.key] || Package;
        const route = typeRoutes[group.key] || '/';
        return (
          <div key={group.key} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-900">{group.label}</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-600">{group.count}</span>
            </div>
            <div className="space-y-1">
              {group.assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => { onClose(); navigate(`${route}?openId=${asset.id}`); }}
                  className="w-full text-left card p-3 hover:shadow-md hover:-translate-y-0.5 transition-all group flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {asset.asset_name || asset.serial_number}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{asset.serial_number}</span>
                      {asset.model && <span>· {asset.model}</span>}
                    </div>
                  </div>
                  {asset.status_name && (
                    <span
                      className="inline-block px-2 py-0.5 text-[11px] font-medium rounded-full border shrink-0"
                      style={{
                        backgroundColor: (asset.status_color || '#64748b') + '15',
                        borderColor: (asset.status_color || '#64748b') + '40',
                        color: asset.status_color || '#475569',
                      }}
                    >
                      {asset.status_name}
                    </span>
                  )}
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RelatedEmployeeList({
  employees, onClose,
}: { employees: RelatedEmployee[]; onClose: () => void }) {
  const navigate = useNavigate();
  if (employees.length === 0) {
    return <div className="text-center text-sm text-slate-400 py-12">No employees linked.</div>;
  }
  return (
    <div className="space-y-1">
      {employees.map((e) => (
        <button
          key={e.id}
          onClick={() => { onClose(); navigate(`/employees?openId=${e.id}`); }}
          className="w-full text-left card p-3 hover:shadow-md hover:-translate-y-0.5 transition-all group flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
            {(e.full_name?.[0] || '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900 truncate">{e.full_name}</span>
              {e.employee_code && <span className="text-[11px] text-slate-400 font-mono">({e.employee_code})</span>}
              {!e.is_active && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-500">Inactive</span>
              )}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
              {e.email && (
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {e.email}</span>
              )}
              {e.department_name && (
                <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {e.department_name}</span>
              )}
              {e.location_name && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {e.location_name}</span>
              )}
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 shrink-0" />
        </button>
      ))}
    </div>
  );
}

export function RelatedConsumableList({
  consumables, onClose,
}: { consumables: RelatedConsumable[]; onClose: () => void }) {
  const navigate = useNavigate();
  if (consumables.length === 0) {
    return <div className="text-center text-sm text-slate-400 py-12">No consumables linked.</div>;
  }
  return (
    <div className="space-y-1">
      {consumables.map((c) => {
        const low = c.minimum_stock != null && c.current_stock <= c.minimum_stock;
        const out = c.current_stock <= 0;
        return (
          <button
            key={c.id}
            onClick={() => { onClose(); navigate(`/consumables?openId=${c.id}`); }}
            className="w-full text-left card p-3 hover:shadow-md hover:-translate-y-0.5 transition-all group flex items-center gap-3"
          >
            <PackageOpen className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">{c.name}</div>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                {c.category && <span>{c.category}</span>}
                <span>· {c.current_stock} {c.unit}</span>
              </div>
            </div>
            {out ? (
              <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border bg-red-50 text-red-700 border-red-200 shrink-0">Out</span>
            ) : low ? (
              <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border bg-amber-50 text-amber-700 border-amber-200 shrink-0">Low</span>
            ) : null}
            <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

export function VendorModelsRollup({ models }: { models: VendorModelRow[] }) {
  if (models.length === 0) {
    return <div className="text-center text-sm text-slate-400 py-12">No models supplied.</div>;
  }
  return (
    <div className="space-y-1">
      {models.map((m) => {
        const Icon = typeIcons[m.asset_type] || Package;
        return (
          <div key={`${m.asset_type}::${m.model}`} className="card p-3 flex items-center gap-3">
            <Icon className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">{m.model}</div>
              <div className="text-xs text-slate-500 mt-0.5">{m.asset_label}</div>
            </div>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-brand-50 text-brand-700 border border-brand-200 shrink-0">
              {m.count} unit{m.count !== 1 ? 's' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CountBadge({ value }: { value: number }) {
  return <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-brand-100 text-brand-700">{value}</span>;
}
