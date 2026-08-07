import { Router } from 'express';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';
// @ts-ignore
import * as XLSX from 'xlsx-js-style';

export const lookupRelatedRouter = Router();
lookupRelatedRouter.use(authMiddleware);

const ASSET_TABLES = [
  { key: 'endpoint',       table: 'endpoints',       label: 'Endpoints',       hasHostName: true },
  { key: 'monitor',        table: 'monitors',        label: 'Monitors',        hasHostName: true },
  { key: 'mobile_device',  table: 'mobile_devices',  label: 'Mobile Devices',  hasHostName: false },
  { key: 'ip_phone',       table: 'ip_phones',       label: 'IP Phones',       hasHostName: false },
  { key: 'server',         table: 'servers',         label: 'Servers',         hasHostName: true },
  { key: 'printer',        table: 'printers',        label: 'Printers',        hasHostName: true },
  { key: 'network_device', table: 'network_devices', label: 'Network Devices', hasHostName: true },
  { key: 'other_asset',    table: 'other_assets',    label: 'Other Assets',    hasHostName: true },
];

interface AssetSummary {
  id: number;
  serial_number: string;
  asset_name: string | null;
  model: string | null;
  status_name: string | null;
  status_color: string | null;
  host_name?: string | null;
}

interface AssetGroup {
  key: string;
  label: string;
  count: number;
  assets: AssetSummary[];
}

async function fetchAssetsByFk(fkColumn: 'department_id' | 'location_id' | 'vendor_id', fkValue: number) {
  const groups: AssetGroup[] = [];
  let totalCount = 0;
  for (const { key, table, label, hasHostName } of ASSET_TABLES) {
    const cols = [
      `${table}.id`,
      `${table}.serial_number`,
      `${table}.asset_name`,
      `${table}.model`,
      'asset_statuses.name as status_name',
      'asset_statuses.color as status_color',
    ];
    if (hasHostName) cols.push(`${table}.host_name`);
    const rows = await db(table)
      .leftJoin('asset_statuses', `${table}.status_id`, 'asset_statuses.id')
      .where(`${table}.${fkColumn}`, fkValue)
      .whereNull(`${table}.deleted_at`)
      .select(cols);
    groups.push({ key, label, count: rows.length, assets: rows as AssetSummary[] });
    totalCount += rows.length;
  }
  return { totalCount, groups: groups.filter((g) => g.count > 0) };
}

// =================== DEPARTMENTS ===================
lookupRelatedRouter.get('/departments/:id/related', async (req, res) => {
  const id = Number(req.params.id);

  const employees = await db('employees')
    .leftJoin('locations', 'employees.location_id', 'locations.id')
    .where({ 'employees.department_id': id })
    .whereNull('employees.deleted_at')
    .select(
      'employees.id',
      'employees.full_name',
      'employees.employee_code',
      'employees.email',
      'employees.is_active',
      'locations.name as location_name',
    )
    .orderBy('employees.full_name', 'asc');

  const assets = await fetchAssetsByFk('department_id', id);

  res.json({
    employees,
    employeesCount: employees.length,
    ...assets,
  });
});

// =================== LOCATIONS ===================
lookupRelatedRouter.get('/locations/:id/related', async (req, res) => {
  const id = Number(req.params.id);

  const employees = await db('employees')
    .leftJoin('departments', 'employees.department_id', 'departments.id')
    .where({ 'employees.location_id': id })
    .whereNull('employees.deleted_at')
    .select(
      'employees.id',
      'employees.full_name',
      'employees.employee_code',
      'employees.email',
      'employees.is_active',
      'departments.name as department_name',
    )
    .orderBy('employees.full_name', 'asc');

  const assets = await fetchAssetsByFk('location_id', id);

  // Consumables stored at this location
  const consumables = await db('consumable_items')
    .where({ location_id: id })
    .whereNull('deleted_at')
    .select('id', 'name', 'category', 'unit', 'current_stock', 'minimum_stock')
    .orderBy('name', 'asc');

  res.json({
    employees,
    employeesCount: employees.length,
    ...assets,
    consumables,
    consumablesCount: consumables.length,
  });
});

// =================== LOCATION EXPORT ===================

const HEADER_STYLE = {
  fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } },
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
  border: { bottom: { style: 'thin', color: { rgb: '3B82F6' } } },
};
const ROW_EVEN = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, font: { sz: 10, name: 'Calibri' }, alignment: { vertical: 'center' } };
const ROW_ODD  = { fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } }, font: { sz: 10, name: 'Calibri' }, alignment: { vertical: 'center' } };

function buildSheet(headers: string[], dataRows: any[][]): any {
  const styledHeader = headers.map((h) => ({ v: h, t: 's', s: HEADER_STYLE }));
  const styledRows = dataRows.map((row, ri) => {
    const s = ri % 2 === 0 ? ROW_EVEN : ROW_ODD;
    return row.map((val) => ({ v: val === null || val === undefined ? '' : val, t: typeof val === 'number' ? 'n' : 's', s }));
  });
  const ws = XLSX.utils.aoa_to_sheet([styledHeader, ...styledRows]);
  ws['!cols'] = headers.map((h, ci) => {
    const max = dataRows.reduce((m, row) => Math.max(m, String(row[ci] ?? '').length), h.length);
    return { wch: Math.min(45, Math.max(12, max + 2)) };
  });
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2' }];
  return ws;
}

const EXPORT_TABLES: {
  table: string;
  label: string;
  extraCols: { col: string; header: string; bool?: boolean }[];
}[] = [
  {
    table: 'endpoints', label: 'Endpoints',
    extraCols: [
      { col: 'host_name',           header: 'Host Name' },
      { col: 'endpoint_type',       header: 'Type' },
      { col: 'asset_code',          header: 'Asset Code' },
      { col: 'mac_address',         header: 'MAC Address' },
      { col: 'ip_address',          header: 'IP Address' },
      { col: 'os_name_version',     header: 'OS / Version' },
      { col: 'is_under_warranty',   header: 'Under Warranty', bool: true },
      { col: 'warranty_expiry_date',header: 'Warranty Expiry' },
      { col: 'eol_date',            header: 'EOL Date' },
      { col: 'data_wiped',          header: 'Data Wiped', bool: true },
      { col: 'data_wiped_by',       header: 'Wiped By' },
      { col: 'data_checked_by',     header: 'Checked By' },
    ],
  },
  {
    table: 'monitors', label: 'Monitors',
    extraCols: [
      { col: 'host_name', header: 'Host Name' },
    ],
  },
  {
    table: 'mobile_devices', label: 'Mobile Devices',
    extraCols: [
      { col: 'eid',             header: 'EID' },
      { col: 'mobile_number',   header: 'Mobile Number' },
      { col: 'sim_number',      header: 'SIM Number' },
      { col: 'imei_number',     header: 'IMEI' },
      { col: 'production_year', header: 'Production Year' },
    ],
  },
  {
    table: 'ip_phones', label: 'IP Phones',
    extraCols: [],
  },
  {
    table: 'servers', label: 'Servers',
    extraCols: [
      { col: 'application_name',    header: 'Application Name' },
      { col: 'can_id',              header: 'CAN ID' },
      { col: 'application_tier',    header: 'App Tier' },
      { col: 'server_class',        header: 'Server Class' },
      { col: 'server_type',         header: 'Server Type' },
      { col: 'environment',         header: 'Environment' },
      { col: 'os_name_version',     header: 'OS / Version' },
      { col: 'server_software',     header: 'Server Software' },
      { col: 'managed_by',          header: 'Managed By' },
      { col: 'ip_address',          header: 'IP Address' },
      { col: 'host_name',           header: 'Host Name' },
      { col: 'asset_code',          header: 'Asset Code' },
      { col: 'dc_location',         header: 'DC Location' },
      { col: 'rack_number',         header: 'Rack Number' },
      { col: 'is_under_warranty',   header: 'Under Warranty', bool: true },
      { col: 'warranty_expiry_date',header: 'Warranty Expiry' },
      { col: 'eol_date',            header: 'EOL Date' },
      { col: 'hardening_status',    header: 'Hardened', bool: true },
      { col: 'patching_status',     header: 'Patched', bool: true },
      { col: 'exception_memo_no',   header: 'Exception Memo #' },
    ],
  },
  {
    table: 'printers', label: 'Printers',
    extraCols: [
      { col: 'device_name', header: 'Device Name' },
      { col: 'host_name',   header: 'Host Name' },
      { col: 'ip_address',  header: 'IP Address' },
      { col: 'managed_by',  header: 'Managed By' },
      { col: 'eol_date',    header: 'EOL Date' },
    ],
  },
  {
    table: 'network_devices', label: 'Network Devices',
    extraCols: [
      { col: 'device_name',         header: 'Device Name' },
      { col: 'host_name',           header: 'Host Name' },
      { col: 'ip_address',          header: 'IP Address' },
      { col: 'asset_code',          header: 'Asset Code' },
      { col: 'managed_by',          header: 'Managed By' },
      { col: 'warranty_expiry_date',header: 'Warranty Expiry' },
      { col: 'eol_date',            header: 'EOL Date' },
    ],
  },
  {
    table: 'other_assets', label: 'Other Assets',
    extraCols: [
      { col: 'host_name', header: 'Host Name' },
    ],
  },
];

function fmtBool(v: any): string { return v ? 'Yes' : 'No'; }

function buildAssetSheet(table: string, extraCols: { col: string; header: string; bool?: boolean }[], rows: any[]): any {
  const headers = [
    'Serial Number', 'Asset Name', 'Model', 'Vendor',
    'Assigned To', 'Employee ID', 'Department', 'Location', 'Status',
    'PO Number', 'Invoice Number', 'Remarks',
    ...extraCols.map((c) => c.header),
  ];
  const dataRows = rows.map((r) => [
    r.serial_number ?? '', r.asset_name ?? '', r.model ?? '',
    r.vendor_name ?? '', r.employee_name ?? '', r.employee_code ?? '',
    r.department_name ?? '', r.location_name ?? '', r.status_name ?? '',
    r.po_number ?? '', r.invoice_number ?? '', r.remarks ?? '',
    ...extraCols.map(({ col, bool }) => {
      const v = (r as any)[col];
      if (bool) return fmtBool(v);
      return v ?? '';
    }),
  ]);
  return buildSheet(headers, dataRows);
}

lookupRelatedRouter.get('/locations/:id/export', async (req, res) => {
  const locationId = Number(req.params.id);

  const loc = await db('locations').where('id', locationId).first('name', 'type', 'country');
  if (!loc) return res.status(404).json({ error: 'Location not found' });

  const wb = XLSX.utils.book_new();
  const summaryRows: any[][] = [];
  let totalAssets = 0;

  for (const { table, label, extraCols } of EXPORT_TABLES) {
    const cols: string[] = [
      `${table}.serial_number`, `${table}.asset_name`, `${table}.model`,
      'vendors.name as vendor_name',
      'employees.full_name as employee_name',
      'employees.employee_code as employee_code',
      'departments.name as department_name',
      'locations.name as location_name',
      'asset_statuses.name as status_name',
      `${table}.po_number`, `${table}.invoice_number`, `${table}.remarks`,
      ...extraCols.map(({ col }) => `${table}.${col}`),
    ];

    const rows = await db(table)
      .leftJoin('vendors',        `${table}.vendor_id`,     'vendors.id')
      .leftJoin('employees',      `${table}.employee_id`,   'employees.id')
      .leftJoin('departments',    `${table}.department_id`, 'departments.id')
      .leftJoin('locations',      `${table}.location_id`,   'locations.id')
      .leftJoin('asset_statuses', `${table}.status_id`,     'asset_statuses.id')
      .where(`${table}.location_id`, locationId)
      .whereNull(`${table}.deleted_at`)
      .select(cols);

    if (rows.length === 0) continue;
    totalAssets += rows.length;

    for (const r of rows as any[]) {
      summaryRows.push([label, r.asset_name ?? '', r.model ?? '', r.serial_number ?? '', r.vendor_name ?? '', r.employee_name ?? '', r.status_name ?? '']);
    }

    XLSX.utils.book_append_sheet(wb, buildAssetSheet(table, extraCols, rows as any[]), label.slice(0, 31));
  }

  // Summary sheet
  if (summaryRows.length > 0) {
    const INFO_LABEL = { fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' }, alignment: { horizontal: 'left', vertical: 'center' } };
    const INFO_VALUE = { fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } }, font: { bold: true, color: { rgb: '1E3A8A' }, sz: 11, name: 'Calibri' }, alignment: { horizontal: 'left', vertical: 'center' } };
    const EMPTY = { v: '', t: 's', s: { fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } } } };

    const summaryHeaders = ['Asset Type', 'Asset Name', 'Model', 'Serial Number', 'Vendor', 'Assigned To', 'Status'];
    const colCount = summaryHeaders.length;

    const nameRow  = [{ v: 'Location',     t: 's', s: INFO_LABEL }, { v: loc.name ?? '',    t: 's', s: INFO_VALUE }, ...Array(colCount - 2).fill(EMPTY)];
    const typeRow  = [{ v: 'Type',         t: 's', s: INFO_LABEL }, { v: loc.type ?? '',    t: 's', s: INFO_VALUE }, ...Array(colCount - 2).fill(EMPTY)];
    const cntryRow = [{ v: 'Country',      t: 's', s: INFO_LABEL }, { v: loc.country ?? '', t: 's', s: INFO_VALUE }, ...Array(colCount - 2).fill(EMPTY)];
    const totalRow = [{ v: 'Total Assets', t: 's', s: INFO_LABEL }, { v: totalAssets,       t: 'n', s: INFO_VALUE }, ...Array(colCount - 2).fill(EMPTY)];

    const styledHeader = summaryHeaders.map((h) => ({ v: h, t: 's', s: HEADER_STYLE }));
    const styledRows = summaryRows.map((row, ri) => {
      const s = ri % 2 === 0 ? ROW_EVEN : ROW_ODD;
      return row.map((val) => ({ v: val === null || val === undefined ? '' : val, t: typeof val === 'number' ? 'n' : 's', s }));
    });

    const ws = XLSX.utils.aoa_to_sheet([nameRow, typeRow, cntryRow, totalRow, styledHeader, ...styledRows]);
    ws['!cols'] = summaryHeaders.map((h, ci) => {
      const maxData = summaryRows.reduce((m, row) => Math.max(m, String(row[ci] ?? '').length), h.length);
      return { wch: Math.min(45, Math.max(14, maxData + 2)) };
    });
    ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 5, topLeftCell: 'A6' }];
    ws['!rows'] = [{ hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 20 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    wb.SheetNames = ['Summary', ...wb.SheetNames.filter((n: string) => n !== 'Summary')];
  }

  if (totalAssets === 0) {
    XLSX.utils.book_append_sheet(wb, buildSheet(['Info'], [['No assets at this location']]), 'Info');
  }

  const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const safeName = (loc.name || 'location').replace(/[^a-z0-9_\- ]/gi, '_');

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}_assets.xlsx"`);
  res.send(buffer);
});

// =================== BULK ALL-ASSETS EXPORT ===================

lookupRelatedRouter.get('/export/bulk', async (req, res) => {
  const requested = String(req.query.types || '').split(',').map((s) => s.trim()).filter(Boolean);
  const tables = requested.length > 0
    ? EXPORT_TABLES.filter((t) => requested.includes(t.table))
    : EXPORT_TABLES;

  if (tables.length === 0) return res.status(400).json({ error: 'No valid asset types specified' });

  const wb = XLSX.utils.book_new();
  const summaryRows: any[][] = [];
  let totalAssets = 0;

  for (const { table, label, extraCols } of tables) {
    const cols: string[] = [
      `${table}.serial_number`, `${table}.asset_name`, `${table}.model`,
      'vendors.name as vendor_name',
      'employees.full_name as employee_name',
      'employees.employee_code as employee_code',
      'departments.name as department_name',
      'locations.name as location_name',
      'asset_statuses.name as status_name',
      `${table}.po_number`, `${table}.invoice_number`, `${table}.remarks`,
      ...extraCols.map(({ col }) => `${table}.${col}`),
    ];

    const rows = await db(table)
      .leftJoin('vendors',        `${table}.vendor_id`,     'vendors.id')
      .leftJoin('employees',      `${table}.employee_id`,   'employees.id')
      .leftJoin('departments',    `${table}.department_id`, 'departments.id')
      .leftJoin('locations',      `${table}.location_id`,   'locations.id')
      .leftJoin('asset_statuses', `${table}.status_id`,     'asset_statuses.id')
      .whereNull(`${table}.deleted_at`)
      .select(cols);

    if (rows.length === 0) continue;
    totalAssets += rows.length;

    for (const r of rows as any[]) {
      summaryRows.push([
        label,
        r.asset_name ?? '', r.model ?? '', r.serial_number ?? '',
        r.vendor_name ?? '', r.employee_name ?? '', r.employee_code ?? '',
        r.department_name ?? '', r.location_name ?? '', r.status_name ?? '',
      ]);
    }

    XLSX.utils.book_append_sheet(wb, buildAssetSheet(table, extraCols, rows as any[]), label.slice(0, 31));
  }

  // Summary sheet
  const summaryHeaders = ['Asset Type', 'Asset Name', 'Model', 'Serial Number', 'Vendor', 'Assigned To', 'Employee ID', 'Department', 'Location', 'Status'];
  const INFO_LABEL = { fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' }, alignment: { horizontal: 'left', vertical: 'center' } };
  const INFO_VALUE = { fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } }, font: { bold: true, color: { rgb: '1E3A8A' }, sz: 11, name: 'Calibri' }, alignment: { horizontal: 'left', vertical: 'center' } };
  const EMPTY_CELL = { v: '', t: 's', s: { fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } } } };
  const colCount = summaryHeaders.length;

  const totalRow  = [{ v: 'Total Assets', t: 's', s: INFO_LABEL }, { v: totalAssets, t: 'n', s: INFO_VALUE }, ...Array(colCount - 2).fill(EMPTY_CELL)];
  const exportRow = [{ v: 'Exported',     t: 's', s: INFO_LABEL }, { v: new Date().toISOString().slice(0, 10), t: 's', s: INFO_VALUE }, ...Array(colCount - 2).fill(EMPTY_CELL)];
  const typesRow  = [{ v: 'Categories',   t: 's', s: INFO_LABEL }, { v: tables.map((t) => t.label).join(', '), t: 's', s: INFO_VALUE }, ...Array(colCount - 2).fill(EMPTY_CELL)];

  const styledHeader = summaryHeaders.map((h) => ({ v: h, t: 's', s: HEADER_STYLE }));
  const styledRows = summaryRows.map((row, ri) => {
    const s = ri % 2 === 0 ? ROW_EVEN : ROW_ODD;
    return row.map((val: any) => ({ v: val === null || val === undefined ? '' : val, t: typeof val === 'number' ? 'n' : 's', s }));
  });

  const ws = XLSX.utils.aoa_to_sheet([totalRow, exportRow, typesRow, styledHeader, ...styledRows]);
  ws['!cols'] = summaryHeaders.map((h, ci) => {
    const maxData = summaryRows.reduce((m, row) => Math.max(m, String(row[ci] ?? '').length), h.length);
    return { wch: Math.min(45, Math.max(14, maxData + 2)) };
  });
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5' }];
  ws['!rows'] = [{ hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 20 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  wb.SheetNames = ['Summary', ...wb.SheetNames.filter((n: string) => n !== 'Summary')];

  const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="all_assets_${date}.xlsx"`);
  res.send(buffer);
});

// =================== VENDORS ===================
lookupRelatedRouter.get('/vendors/:id/related', async (req, res) => {
  const id = Number(req.params.id);

  const assets = await fetchAssetsByFk('vendor_id', id);

  // Models supplied rollup — count of each (asset_type, model) combination
  const modelMap = new Map<string, { asset_type: string; asset_label: string; model: string; count: number }>();
  for (const group of assets.groups) {
    for (const a of group.assets) {
      if (!a.model) continue;
      const k = `${group.key}::${a.model}`;
      const existing = modelMap.get(k);
      if (existing) existing.count++;
      else modelMap.set(k, { asset_type: group.key, asset_label: group.label, model: a.model, count: 1 });
    }
  }
  const models = Array.from(modelMap.values()).sort((a, b) => b.count - a.count);

  // Consumables from this vendor
  const consumables = await db('consumable_items')
    .where({ vendor_id: id })
    .whereNull('deleted_at')
    .select('id', 'name', 'category', 'unit', 'current_stock', 'minimum_stock')
    .orderBy('name', 'asc');

  res.json({
    ...assets,
    models,
    modelsCount: models.length,
    consumables,
    consumablesCount: consumables.length,
  });
});
