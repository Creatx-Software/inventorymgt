import { Router } from 'express';
// @ts-ignore — xlsx-js-style typings not included; uses same API as xlsx
import * as XLSX from 'xlsx-js-style';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';

export const employeeAssetsRouter = Router();
employeeAssetsRouter.use(authMiddleware);

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

employeeAssetsRouter.get('/:id/assets', async (req, res) => {
  const employeeId = Number(req.params.id);
  const result: {
    key: string;
    label: string;
    count: number;
    assets: { id: number; serial_number: string; asset_name: string | null; model: string | null; status_name: string; status_color: string }[];
  }[] = [];

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
      .where(`${table}.employee_id`, employeeId)
      .whereNull(`${table}.deleted_at`)
      .select(cols);
    result.push({ key, label, count: rows.length, assets: rows as any });
  }

  const totalCount = result.reduce((s, r) => s + r.count, 0);
  res.json({ totalCount, groups: result.filter((r) => r.count > 0) });
});

// ---------------------------------------------------------------------------
// Excel export — matches the DataTable export style exactly
// Header: dark blue bg, white bold text | Rows: alternating white / light blue
// ---------------------------------------------------------------------------

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
    return row.map((val) => ({
      v: val === null || val === undefined ? '' : val,
      t: typeof val === 'number' ? 'n' : 's',
      s,
    }));
  });

  const ws = XLSX.utils.aoa_to_sheet([styledHeader, ...styledRows]);

  // Auto column widths
  ws['!cols'] = headers.map((h, ci) => {
    const max = dataRows.reduce((m, row) => Math.max(m, String(row[ci] ?? '').length), h.length);
    return { wch: Math.min(45, Math.max(12, max + 2)) };
  });

  // Freeze header row
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2' }];

  return ws;
}

employeeAssetsRouter.get('/:id/export', async (req, res) => {
  const employeeId = Number(req.params.id);

  const emp = await db('employees').where('id', employeeId).first('full_name', 'employee_code');
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const wb = XLSX.utils.book_new();

  // Accumulate all assets for the summary sheet
  const summaryRows: any[][] = [];

  const EXPORT_TABLES = [
    { table: 'endpoints',       label: 'Endpoints',       hasHostName: true,  extraCols: [{ col: 'ip_address', header: 'IP Address' }, { col: 'os_name_version', header: 'OS / Version' }] },
    { table: 'monitors',        label: 'Monitors',        hasHostName: true,  extraCols: [] as { col: string; header: string }[] },
    { table: 'mobile_devices',  label: 'Mobile Devices',  hasHostName: false, extraCols: [{ col: 'mobile_number', header: 'Mobile Number' }, { col: 'imei_number', header: 'IMEI' }] },
    { table: 'ip_phones',       label: 'IP Phones',       hasHostName: false, extraCols: [{ col: 'phone_number', header: 'Phone Number' }] },
    { table: 'servers',         label: 'Servers',         hasHostName: true,  extraCols: [{ col: 'application_name', header: 'Application' }, { col: 'ip_address', header: 'IP Address' }] },
    { table: 'printers',        label: 'Printers',        hasHostName: true,  extraCols: [{ col: 'ip_address', header: 'IP Address' }] },
    { table: 'network_devices', label: 'Network Devices', hasHostName: true,  extraCols: [{ col: 'ip_address', header: 'IP Address' }] },
    { table: 'other_assets',    label: 'Other Assets',    hasHostName: true,  extraCols: [] as { col: string; header: string }[] },
  ];

  let totalAssets = 0;

  for (const { table, label, hasHostName, extraCols } of EXPORT_TABLES) {
    const cols: string[] = [
      `${table}.serial_number`,
      `${table}.asset_name`,
      `${table}.model`,
      'vendors.name as vendor_name',
      'locations.name as location_name',
      'departments.name as department_name',
      'asset_statuses.name as status_name',
      `${table}.po_number`,
      `${table}.invoice_number`,
      `${table}.remarks`,
    ];
    if (hasHostName) cols.push(`${table}.host_name`);
    for (const { col } of extraCols) cols.push(`${table}.${col}`);

    const rows = await db(table)
      .leftJoin('vendors',        `${table}.vendor_id`,     'vendors.id')
      .leftJoin('locations',      `${table}.location_id`,   'locations.id')
      .leftJoin('departments',    `${table}.department_id`, 'departments.id')
      .leftJoin('asset_statuses', `${table}.status_id`,     'asset_statuses.id')
      .where(`${table}.employee_id`, employeeId)
      .whereNull(`${table}.deleted_at`)
      .select(cols);

    if (rows.length === 0) continue;
    totalAssets += rows.length;

    // Add to summary
    for (const r of rows as any[]) {
      summaryRows.push([label, r.asset_name ?? '', r.model ?? '', r.serial_number ?? '', r.vendor_name ?? '']);
    }

    const headers: string[] = [
      'Serial Number', 'Asset Name', 'Model', 'Vendor',
      'Location', 'Department', 'Status',
      'PO Number', 'Invoice Number', 'Remarks',
    ];
    if (hasHostName) headers.push('Host Name');
    for (const { header } of extraCols) headers.push(header);

    const dataRows = (rows as any[]).map((r) => {
      const row: any[] = [
        r.serial_number ?? '', r.asset_name ?? '', r.model ?? '',
        r.vendor_name ?? '', r.location_name ?? '', r.department_name ?? '',
        r.status_name ?? '', r.po_number ?? '', r.invoice_number ?? '', r.remarks ?? '',
      ];
      if (hasHostName) row.push(r.host_name ?? '');
      for (const { col } of extraCols) row.push(r[col] ?? '');
      return row;
    });

    XLSX.utils.book_append_sheet(wb, buildSheet(headers, dataRows), label.slice(0, 31));
  }

  // Consumables sheet
  const consRows: any[] = await db('consumable_transactions')
    .join('consumable_items', 'consumable_transactions.consumable_item_id', 'consumable_items.id')
    .where('consumable_transactions.employee_id', employeeId)
    .whereNull('consumable_items.deleted_at')
    .select(
      'consumable_items.name',
      'consumable_items.category',
      'consumable_items.unit',
      db.raw(`SUM(CASE WHEN consumable_transactions.transaction_type = 'assigned' THEN consumable_transactions.quantity ELSE 0 END) as total_assigned`),
      db.raw(`SUM(CASE WHEN consumable_transactions.transaction_type = 'returned' THEN consumable_transactions.quantity ELSE 0 END) as total_returned`),
      db.raw(`SUM(CASE WHEN consumable_transactions.transaction_type = 'assigned' THEN consumable_transactions.quantity ELSE 0 END) - SUM(CASE WHEN consumable_transactions.transaction_type = 'returned' THEN consumable_transactions.quantity ELSE 0 END) as net_quantity`),
    )
    .groupBy('consumable_items.id', 'consumable_items.name', 'consumable_items.category', 'consumable_items.unit')
    .having(db.raw('net_quantity > 0'));

  if (consRows.length > 0) {
    const headers = ['Item Name', 'Category', 'Unit', 'Qty Assigned', 'Qty Returned', 'Currently Held'];
    const dataRows = consRows.map((r) => [
      r.name, r.category ?? '', r.unit,
      Number(r.total_assigned), Number(r.total_returned), Number(r.net_quantity),
    ]);
    XLSX.utils.book_append_sheet(wb, buildSheet(headers, dataRows), 'Consumables');
  }

  // Summary sheet — employee info block at top, then data table
  if (summaryRows.length > 0) {
    const summaryHeaders = ['Asset Type', 'Asset Name', 'Model', 'Serial Number', 'Vendor'];
    const colCount = summaryHeaders.length;

    const INFO_LABEL = {
      fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } },
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
    const INFO_VALUE = {
      fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } },
      font: { bold: true, color: { rgb: '1E3A8A' }, sz: 11, name: 'Calibri' },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
    const EMPTY_CELL = { v: '', t: 's', s: { fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } } } };

    // Row 1: Employee Name
    const nameRow = [
      { v: 'Employee Name', t: 's', s: INFO_LABEL },
      { v: emp.full_name ?? '', t: 's', s: INFO_VALUE },
      ...Array(colCount - 2).fill(EMPTY_CELL),
    ];
    // Row 2: Employee ID
    const idRow = [
      { v: 'Employee ID', t: 's', s: INFO_LABEL },
      { v: emp.employee_code ?? '—', t: 's', s: INFO_VALUE },
      ...Array(colCount - 2).fill(EMPTY_CELL),
    ];

    const styledHeader = summaryHeaders.map((h) => ({ v: h, t: 's', s: HEADER_STYLE }));
    const styledRows = summaryRows.map((row, ri) => {
      const s = ri % 2 === 0 ? ROW_EVEN : ROW_ODD;
      return row.map((val) => ({ v: val === null || val === undefined ? '' : val, t: typeof val === 'number' ? 'n' : 's', s }));
    });

    const ws = XLSX.utils.aoa_to_sheet([nameRow, idRow, styledHeader, ...styledRows]);

    // Auto column widths (account for info rows too)
    ws['!cols'] = summaryHeaders.map((h, ci) => {
      const maxData = summaryRows.reduce((m, row) => Math.max(m, String(row[ci] ?? '').length), h.length);
      return { wch: Math.min(45, Math.max(14, maxData + 2)) };
    });

    // Freeze after the 3 header rows (row 1+2 = info, row 3 = column headers)
    ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 3, topLeftCell: 'A4' }];

    // Row heights: info rows taller
    ws['!rows'] = [{ hpt: 22 }, { hpt: 22 }, { hpt: 20 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    wb.SheetNames = ['Summary', ...wb.SheetNames.filter((n: string) => n !== 'Summary')];
  }

  if (totalAssets === 0 && consRows.length === 0) {
    XLSX.utils.book_append_sheet(wb, buildSheet(['Info'], [['No assets assigned to this employee']]), 'Info');
  }

  const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const safeName = (emp.full_name || 'employee').replace(/[^a-z0-9_\- ]/gi, '_');
  const filename = `${safeName}${emp.employee_code ? '_' + emp.employee_code : ''}_assets.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

// Bulk mark employees as reviewed
employeeAssetsRouter.post('/bulk-review', async (req, res) => {
  const ids: number[] = req.body?.ids || [];
  if (!ids.length) return res.json({ updated: 0 });
  const n = await db('employees').whereIn('id', ids).update({ needs_review: false });
  res.json({ updated: n });
});
