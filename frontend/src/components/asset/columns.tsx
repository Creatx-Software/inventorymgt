import type { ColumnDef } from '@tanstack/react-table';
import type { AssetCommon } from '../../types/assets';
import { StatusBadge, fmtDate } from './CommonFields';
import { Clock } from 'lucide-react';

export function commonAssetColumns<T extends AssetCommon>(): ColumnDef<T, any>[] {
  return [
    {
      accessorKey: 'serial_number',
      header: 'Serial',
      size: 200,
      cell: (i) => (
        <div className="flex items-center gap-1.5">
          {i.row.original.has_pending_approval ? (
            <span title="Pending superadmin approval">
              <Clock className="w-3 h-3 text-amber-500 shrink-0" />
            </span>
          ) : null}
          <span className="font-mono text-xs">{i.getValue() as string}</span>
        </div>
      ),
    },
    { accessorKey: 'asset_name', header: 'Name', size: 180, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
    { accessorKey: 'vendor_name', header: 'Vendor', size: 150, enableSorting: false, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
    { accessorKey: 'model', header: 'Model', size: 180, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
    { accessorKey: 'status_name', header: 'Status', size: 120, enableSorting: false,
      cell: (i) => <StatusBadge name={i.row.original.status_name} color={i.row.original.status_color} /> },
    { accessorKey: 'employee_name', header: 'Assigned To', size: 200, enableSorting: false,
      cell: (i) => {
        const name = i.row.original.employee_name;
        const code = i.row.original.employee_code;
        if (!name) return <span className="text-slate-300">— Unassigned —</span>;
        return <span>{name}{code ? <span className="text-slate-400 text-xs ml-1">({code})</span> : ''}</span>;
      },
    },
    { accessorKey: 'location_name', header: 'Location', size: 180, enableSorting: false, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
    { accessorKey: 'department_name', header: 'Department', size: 150, enableSorting: false, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
    { accessorKey: 'po_number', header: 'PO #', size: 140, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
    { accessorKey: 'invoice_number', header: 'Invoice #', size: 140, cell: (i) => i.getValue() || <span className="text-slate-300">—</span> },
    { accessorKey: 'created_at', header: 'Created', size: 110, cell: (i) => fmtDate(i.getValue() as string) },
  ];
}
