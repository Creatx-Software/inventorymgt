import type { ColumnDef } from '@tanstack/react-table';
import type { AssetCommon } from '../../types/assets';
import { StatusBadge, fmtDate } from './CommonFields';

export function commonAssetColumns<T extends AssetCommon>(): ColumnDef<T, any>[] {
  return [
    { accessorKey: 'serial_number', header: 'Serial', size: 200, cell: (i) => <span className="font-mono text-xs">{i.getValue() as string}</span> },
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
