import { Router } from 'express';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { enrichAuditRows, ENTITY_TYPES } from '../services/entity-resolver.service';
// @ts-ignore — xlsx-js-style typings not included; uses same API as xlsx
import * as XLSX from 'xlsx-js-style';

export const auditRouter = Router();
auditRouter.use(authMiddleware);

// Returns the list of entity-type keys + display names — used by the UI filter dropdown
auditRouter.get('/entity-types', (_req, res) => {
  const list = Object.entries(ENTITY_TYPES).map(([key, cfg]) => ({
    key,
    displayName: cfg.displayName,
  }));
  res.json(list);
});

// Asset entity types only (not employees, vendors, etc.)
const ASSET_ENTITY_TYPES = ['endpoint', 'monitor', 'mobile_device', 'ip_phone', 'server', 'printer', 'network_device', 'other_asset'];

// Asset types for the weekly report (consumables handled separately via transactions)
const WEEKLY_ENTITY_TYPES = ASSET_ENTITY_TYPES;

const ASSET_TABLE_MAP: Record<string, string> = {
  endpoint: 'endpoints', monitor: 'monitors', mobile_device: 'mobile_devices',
  ip_phone: 'ip_phones', server: 'servers', printer: 'printers',
  network_device: 'network_devices', other_asset: 'other_assets',
};

// Common columns shown for every asset type (default order)
const COMMON_COLS = [
  { key: 'asset_name',    label: 'Asset Name' },
  { key: 'vendor_name',   label: 'Vendor' },
  { key: 'model',         label: 'Model' },
  { key: 'serial_number', label: 'Serial Number' },
  { key: 'status_name',   label: 'Status' },
  { key: 'location_name', label: 'Location' },
  { key: 'dept_name',     label: 'Department' },
  { key: 'employee_code', label: 'Employee ID' },
  { key: 'employee_name', label: 'Employee Name' },
  { key: 'po_number',     label: 'PO Number' },
  { key: 'invoice_number',label: 'Invoice Number' },
  { key: 'remarks',       label: 'Remarks' },
];

// Per-type column sets — full override for endpoint, extras appended for others
const ENDPOINT_COLS = [
  { key: 'asset_name',    label: 'Asset Name' },
  { key: 'vendor_name',   label: 'Vendor' },
  { key: 'model',         label: 'Model' },
  { key: 'host_name',     label: 'Host Name' },
  { key: 'asset_code',    label: 'Asset Code' },
  { key: 'serial_number', label: 'Serial Number' },
  { key: 'ip_address',    label: 'IP Address' },
  { key: 'status_name',   label: 'Status' },
  { key: 'location_name', label: 'Location' },
  { key: 'dept_name',     label: 'Department' },
  { key: 'employee_code', label: 'Employee ID' },
  { key: 'employee_name', label: 'Employee Name' },
  { key: 'os_name_version', label: 'OS' },
  { key: 'mac_address',   label: 'MAC' },
  { key: 'endpoint_type', label: 'Type' },
  { key: 'po_number',     label: 'PO Number' },
  { key: 'invoice_number',label: 'Invoice Number' },
  { key: 'remarks',       label: 'Remarks' },
];

const EXTRA_COLS: Record<string, { key: string; label: string }[]> = {
  endpoint:       [],  // uses ENDPOINT_COLS override — no extras needed
  monitor:        [{ key: 'host_name', label: 'Host Name' }],
  mobile_device:  [{ key: 'mobile_number', label: 'Phone Number' }, { key: 'imei_number', label: 'IMEI' }, { key: 'sim_number', label: 'SIM' }],
  ip_phone:       [{ key: 'phone_number', label: 'Phone Number' }, { key: 'mac_address', label: 'MAC' }],
  server:         [{ key: 'application_name', label: 'Application' }, { key: 'host_name', label: 'Host Name' }, { key: 'ip_address', label: 'IP Address' }, { key: 'environment', label: 'Environment' }],
  printer:        [{ key: 'device_name', label: 'Device Name' }, { key: 'host_name', label: 'Host Name' }, { key: 'ip_address', label: 'IP Address' }],
  network_device: [{ key: 'device_name', label: 'Device Name' }, { key: 'host_name', label: 'Host Name' }, { key: 'ip_address', label: 'IP Address' }],
  other_asset:    [{ key: 'host_name', label: 'Host Name' }],
};

// Audit-log change columns (appended at the end of each row)
const CHANGE_COLS = [
  { key: '__change_date__',  label: 'Change Date' },
  { key: '__change_time__',  label: 'Change Time' },
  { key: '__changed_by__',   label: 'Changed By' },
  { key: '__action__',       label: 'Action' },
  { key: '__what_changed__', label: 'What Changed' },
];

auditRouter.get('/changes-report', async (req, res) => {
  const { from, to } = req.query as Record<string, string>;

  // 1. Fetch audit log rows for asset types only
  const q = db('audit_logs')
    .leftJoin('users', 'audit_logs.user_id', 'users.id')
    .whereIn('audit_logs.entity_type', ASSET_ENTITY_TYPES)
    .whereIn('audit_logs.action', ['CREATE', 'UPDATE', 'DELETE', 'RESTORE'])
    .select('audit_logs.*', 'users.full_name as user_full_name', 'users.username');
  if (from) q.where('audit_logs.created_at', '>=', from);
  if (to)   q.where('audit_logs.created_at', '<=', `${to} 23:59:59`);
  q.orderBy('audit_logs.created_at', 'asc');

  const auditRows = await q;

  // 2. Collect asset ids per type
  const idsByType = new Map<string, Set<number>>();
  for (const row of auditRows as any[]) {
    if (!row.entity_id) continue;
    if (!idsByType.has(row.entity_type)) idsByType.set(row.entity_type, new Set());
    idsByType.get(row.entity_type)!.add(Number(row.entity_id));
  }

  // 3. Load lookup maps (vendors, locations, departments, employees, statuses)
  const [vendors, locations, departments, employees, statuses] = await Promise.all([
    db('vendors').select('id', 'name'),
    db('locations').select('id', 'name'),
    db('departments').select('id', 'name'),
    db('employees').select('id', 'full_name', 'employee_code'),
    db('asset_statuses').select('id', 'name'),
  ]);
  const vendorMap   = new Map((vendors   as any[]).map((r: any) => [r.id, r.name]));
  const locationMap = new Map((locations as any[]).map((r: any) => [r.id, r.name]));
  const deptMap     = new Map((departments as any[]).map((r: any) => [r.id, r.name]));
  const empMap      = new Map((employees as any[]).map((r: any) => [r.id, { name: r.full_name, code: r.employee_code }]));
  const statusMap   = new Map((statuses  as any[]).map((r: any) => [r.id, r.name]));

  // 4. Load current asset rows per type
  const assetsByType = new Map<string, Map<number, any>>();
  for (const [type, idSet] of idsByType.entries()) {
    const table = ASSET_TABLE_MAP[type];
    if (!table) continue;
    const rows = await db(table).whereIn('id', Array.from(idSet));
    const map = new Map<number, any>();
    for (const r of rows as any[]) map.set(r.id, r);
    assetsByType.set(type, map);
  }

  // 5. Build a summary of what changed from the audit log changes JSON
  const summariseChanges = (changes: any): string => {
    if (!changes || typeof changes !== 'object') return '';
    const parts: string[] = [];
    const parseChanges = (raw: any) => {
      try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return raw; }
    };
    const c = parseChanges(changes);
    if (!c || typeof c !== 'object') return String(c ?? '');
    for (const [k, v] of Object.entries(c)) {
      if (k === 'updated_at' || k === 'created_at') continue;
      const label = k.replace(/_id$/, '').replace(/_/g, ' ');
      const fmtVal = (val: any): string => {
        if (val == null) return '—';
        if (typeof val === 'object' && 'label' in val) return val.label || String(val.id ?? '');
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        return String(val);
      };
      if (v && typeof v === 'object' && ('before' in v || 'after' in v)) {
        parts.push(`${label}: ${fmtVal((v as any).before)} → ${fmtVal((v as any).after)}`);
      } else if (v && typeof v === 'object' && ('id' in v || 'label' in v)) {
        parts.push(`${label}: ${fmtVal(v)}`);
      } else {
        parts.push(`${label}: ${fmtVal(v)}`);
      }
    }
    return parts.join('; ');
  };

  // 6. Group audit rows by entity_type, build sheet data
  const byType = new Map<string, any[]>();
  for (const row of auditRows as any[]) {
    const type = row.entity_type;
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(row);
  }

  // ── Styles — premium design (shared with weekly-report) ───────────────────
  const B0  = { style: 'thin',   color: { rgb: 'E2E8F0' } };
  const B1  = { style: 'thin',   color: { rgb: '94A3B8' } };
  const B2  = { style: 'medium', color: { rgb: '475569' } };
  const CB  = { top: B0, bottom: B0, left: B0, right: B0 };
  const OB  = { top: B2, bottom: B2, left: B2, right: B2 };

  const S_TITLE    = { font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' }, name: 'Calibri' }, fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } }, alignment: { horizontal: 'left', vertical: 'center', indent: 2 }, border: OB };
  const S_SUBTITLE = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' }, name: 'Calibri' }, fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } }, alignment: { horizontal: 'left', vertical: 'center', indent: 2 }, border: { top: B0, bottom: B1, left: B2, right: B2 } };
  const S_META     = { font: { sz: 10, color: { rgb: '334155' }, name: 'Calibri', italic: true }, fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } }, alignment: { horizontal: 'left', vertical: 'center', indent: 2 }, border: { top: B0, bottom: B1, left: B2, right: B2 } };
  const S_DIVIDER  = { fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } } };
  const S_HDR_ASSET  = { fill: { patternType: 'solid', fgColor: { rgb: '1E40AF' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center', wrapText: false }, border: { top: B1, bottom: B2, left: B0, right: B0 } };
  const S_HDR_CHANGE = { fill: { patternType: 'solid', fgColor: { rgb: '0F766E' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center', wrapText: false }, border: { top: B1, bottom: B2, left: B0, right: B0 } };
  const S_ROW_EVEN = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, font: { sz: 10, name: 'Calibri', color: { rgb: '1E293B' } }, alignment: { vertical: 'center', wrapText: false }, border: CB };
  const S_ROW_ODD  = { fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } }, font: { sz: 10, name: 'Calibri', color: { rgb: '1E293B' } }, alignment: { vertical: 'center', wrapText: false }, border: CB };
  const S_BOLD_EVEN = { ...S_ROW_EVEN, font: { ...S_ROW_EVEN.font, bold: true, color: { rgb: '0F172A' } } };
  const S_BOLD_ODD  = { ...S_ROW_ODD,  font: { ...S_ROW_ODD.font,  bold: true, color: { rgb: '0F172A' } } };
  const S_NAME_EVEN = { ...S_BOLD_EVEN, border: { ...CB, left: { style: 'medium', color: { rgb: '3B82F6' } } } };
  const S_NAME_ODD  = { ...S_BOLD_ODD,  border: { ...CB, left: { style: 'medium', color: { rgb: '3B82F6' } } } };
  const S_SUM_HDR   = { fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: B2, bottom: B2, left: B0, right: B0 } };
  const S_SUM_TOTAL = { fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center' }, border: OB };
  const S_LABEL_EVEN = { ...S_ROW_EVEN, border: { ...CB, left: { style: 'medium', color: { rgb: '6366F1' } } } };
  const S_LABEL_ODD  = { ...S_ROW_ODD,  border: { ...CB, left: { style: 'medium', color: { rgb: '6366F1' } } } };

  const ACTION_STYLE: Record<string, { bg: string; fg: string }> = {
    CREATE:  { bg: 'DCFCE7', fg: '14532D' },
    UPDATE:  { bg: 'DBEAFE', fg: '1E3A8A' },
    DELETE:  { bg: 'FEE2E2', fg: '7F1D1D' },
    RESTORE: { bg: 'F3E8FF', fg: '4C1D95' },
  };

  const cell = (v: any, s: any, overrides?: any) => ({
    v: v == null ? '' : String(v), t: 's',
    s: overrides ? { ...s, ...overrides, font: { ...s.font, ...(overrides.font || {}) }, fill: overrides.fill || s.fill } : s,
  });

  const now2 = new Date();
  const reportPeriod = (from && to) ? `${from} to ${to}` : from ? `from ${from}` : to ? `up to ${to}` : 'All time';
  const generatedAt = now2.toLocaleString('en-GB');

  const wb = XLSX.utils.book_new();

  // ── Summary sheet ─────────────────────────────────────────────────────────
  const summaryRows: any[][] = [
    [{ v: '  IT Asset — Changes Report', t: 's', s: S_TITLE }],
    [{ v: `  Period: ${reportPeriod}`, t: 's', s: S_SUBTITLE }],
    [{ v: `  Generated: ${generatedAt}`, t: 's', s: S_META }],
    [
      { v: 'Asset Type',    t: 's', s: S_SUM_HDR },
      { v: 'Total Changes', t: 's', s: S_SUM_HDR },
      { v: 'Created',       t: 's', s: S_SUM_HDR },
      { v: 'Updated',       t: 's', s: S_SUM_HDR },
      { v: 'Deleted',       t: 's', s: S_SUM_HDR },
      { v: 'Restored',      t: 's', s: S_SUM_HDR },
    ],
  ];
  let grandTotal = 0;
  let sumIdx = 0;
  for (const type of ASSET_ENTITY_TYPES) {
    const rows = byType.get(type) || [];
    if (rows.length === 0) continue;
    const cfg = ENTITY_TYPES[type];
    const counts = { CREATE: 0, UPDATE: 0, DELETE: 0, RESTORE: 0 } as Record<string, number>;
    rows.forEach((r: any) => { if (r.action in counts) counts[r.action]++; });
    grandTotal += rows.length;
    const s  = sumIdx % 2 === 0 ? S_LABEL_EVEN : S_LABEL_ODD;
    const sn = sumIdx % 2 === 0 ? S_ROW_EVEN   : S_ROW_ODD;
    sumIdx++;
    const ctr = { alignment: { horizontal: 'center', vertical: 'center' } };
    summaryRows.push([
      cell(cfg?.displayName || type, s),
      cell(rows.length,       { ...sn, ...ctr, font: { ...sn.font, bold: true, color: { rgb: '1E3A8A' } } }),
      cell(counts.CREATE  > 0 ? counts.CREATE  : '', { ...sn, ...ctr, font: { ...sn.font, bold: true, color: { rgb: '14532D' } }, fill: { patternType: 'solid', fgColor: { rgb: counts.CREATE  > 0 ? 'DCFCE7' : sn.fill.fgColor.rgb } } }),
      cell(counts.UPDATE  > 0 ? counts.UPDATE  : '', { ...sn, ...ctr, font: { ...sn.font, bold: true, color: { rgb: '1E3A8A' } }, fill: { patternType: 'solid', fgColor: { rgb: counts.UPDATE  > 0 ? 'DBEAFE' : sn.fill.fgColor.rgb } } }),
      cell(counts.DELETE  > 0 ? counts.DELETE  : '', { ...sn, ...ctr, font: { ...sn.font, bold: true, color: { rgb: '7F1D1D' } }, fill: { patternType: 'solid', fgColor: { rgb: counts.DELETE  > 0 ? 'FEE2E2' : sn.fill.fgColor.rgb } } }),
      cell(counts.RESTORE > 0 ? counts.RESTORE : '', { ...sn, ...ctr, font: { ...sn.font, bold: true, color: { rgb: '4C1D95' } }, fill: { patternType: 'solid', fgColor: { rgb: counts.RESTORE > 0 ? 'F3E8FF' : sn.fill.fgColor.rgb } } }),
    ]);
  }
  summaryRows.push([{ v: '', t: 's', s: S_DIVIDER }]);
  summaryRows.push([
    cell('  TOTAL CHANGES', S_SUM_TOTAL),
    cell(grandTotal, { ...S_SUM_TOTAL, alignment: { horizontal: 'center', vertical: 'center' } }),
    cell('', S_SUM_TOTAL), cell('', S_SUM_TOTAL), cell('', S_SUM_TOTAL), cell('', S_SUM_TOTAL),
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  wsSummary['!rows'] = [{ hpt: 36 }, { hpt: 20 }, { hpt: 18 }, { hpt: 24 }];
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
    { s: { r: summaryRows.length - 2, c: 0 }, e: { r: summaryRows.length - 2, c: 5 } },
    { s: { r: summaryRows.length - 1, c: 0 }, e: { r: summaryRows.length - 1, c: 1 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── Per-type sheets ────────────────────────────────────────────────────────
  for (const type of ASSET_ENTITY_TYPES) {
    const rows = byType.get(type);
    if (!rows || rows.length === 0) continue;

    const cfg = ENTITY_TYPES[type];
    const sheetName = cfg?.displayName || type;
    const assetMap = assetsByType.get(type) || new Map();
    const extraCols = type === 'endpoint' ? [] : (EXTRA_COLS[type] || []);
    const assetCols = type === 'endpoint' ? ENDPOINT_COLS : [...COMMON_COLS, ...extraCols];
    const allCols   = [...assetCols, ...CHANGE_COLS];

    const titleAoa: any[][] = [
      [{ v: `  IT Asset Report — ${sheetName}`, t: 's', s: S_TITLE }],
      [{ v: `  Period: ${reportPeriod}`, t: 's', s: S_SUBTITLE }],
      [{ v: `  ${rows.length} change(s)   |   Generated: ${generatedAt}`, t: 's', s: S_META }],
      [
        ...assetCols.map((c) => ({ v: c.label, t: 's', s: S_HDR_ASSET })),
        ...CHANGE_COLS.map((c) => ({ v: c.label, t: 's', s: S_HDR_CHANGE })),
      ],
    ];

    const dataRows = rows.map((auditRow: any, ri: number) => {
      const asset = assetMap.get(Number(auditRow.entity_id)) || {};
      const emp   = empMap.get(Number(asset.employee_id));
      const s     = ri % 2 === 0 ? S_ROW_EVEN  : S_ROW_ODD;
      const sBold = ri % 2 === 0 ? S_BOLD_EVEN : S_BOLD_ODD;
      const sName = ri % 2 === 0 ? S_NAME_EVEN : S_NAME_ODD;

      const changeDate = auditRow.created_at ? new Date(auditRow.created_at).toLocaleDateString('en-GB') : '';
      const changeTime = auditRow.created_at ? new Date(auditRow.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
      let changes: any = auditRow.changes;
      try { if (typeof changes === 'string') changes = JSON.parse(changes); } catch {}
      const whatChanged = summariseChanges(changes);
      const action = auditRow.action as string;
      const actionStyle = ACTION_STYLE[action] || { bg: 'F1F5F9', fg: '475569' };

      const vals: Record<string, any> = {
        serial_number: asset.serial_number, asset_name: asset.asset_name,
        model: asset.model, vendor_name: vendorMap.get(Number(asset.vendor_id)),
        status_name: statusMap.get(Number(asset.status_id)), location_name: locationMap.get(Number(asset.location_id)),
        dept_name: deptMap.get(Number(asset.department_id)), employee_name: emp?.name,
        employee_code: emp?.code, po_number: asset.po_number, invoice_number: asset.invoice_number,
        remarks: asset.remarks, host_name: asset.host_name, ip_address: asset.ip_address,
        os_name_version: asset.os_name_version, mac_address: asset.mac_address,
        endpoint_type: asset.endpoint_type, asset_code: asset.asset_code,
        mobile_number: asset.mobile_number, imei_number: asset.imei_number, sim_number: asset.sim_number,
        phone_number: asset.phone_number, application_name: asset.application_name,
        environment: asset.environment, device_name: asset.device_name,
        __change_date__: changeDate, __change_time__: changeTime,
        __changed_by__: auditRow.user_full_name || auditRow.username || '',
        __action__: action, __what_changed__: whatChanged,
      };

      return allCols.map((c) => {
        const v = vals[c.key];
        if (c.key === '__action__')       return { v: v ?? '', t: 's', s: { ...s, fill: { patternType: 'solid', fgColor: { rgb: actionStyle.bg } }, font: { ...s.font, bold: true, color: { rgb: actionStyle.fg } }, alignment: { horizontal: 'center', vertical: 'center' } } };
        if (c.key === '__change_date__')  return cell(v, { ...s, font: { ...s.font, color: { rgb: '0F766E' } }, alignment: { horizontal: 'center', vertical: 'center' } });
        if (c.key === '__change_time__')  return cell(v, { ...s, font: { ...s.font, color: { rgb: '0F766E' } }, alignment: { horizontal: 'center', vertical: 'center' } });
        if (c.key === '__changed_by__')   return cell(v, { ...s, font: { ...s.font, italic: true } });
        if (c.key === 'asset_name')       return cell(v, sName);
        if (c.key === 'serial_number')    return cell(v, sBold);
        if (c.key === 'status_name')      return cell(v, { ...s, alignment: { horizontal: 'center', vertical: 'center' } });
        return cell(v, s);
      });
    });

    const colWidths = allCols.map((c, ci) => {
      let max = c.label.length;
      for (const dr of dataRows) {
        const len = String((dr[ci] as any).v ?? '').length;
        if (len > max) max = len;
      }
      return { wch: Math.min(Math.max(max + 2, 10), 50) };
    });

    const ws = XLSX.utils.aoa_to_sheet([...titleAoa, ...dataRows]);
    ws['!cols'] = colWidths;
    ws['!rows'] = [{ hpt: 36 }, { hpt: 20 }, { hpt: 18 }, { hpt: 24 }, ...dataRows.map(() => ({ hpt: 18 }))];
    ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5' }];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: allCols.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: allCols.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: allCols.length - 1 } },
    ];
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  }

  if (wb.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[{ v: 'No changes found in selected date range', t: 's', s: S_META }]]), 'No Data');
  }

  const stamp = `${now2.getFullYear()}${String(now2.getMonth()+1).padStart(2,'0')}${String(now2.getDate()).padStart(2,'0')}`;
  const filename = `changes_report_${stamp}.xlsx`;
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
});

// ── Weekly / Current-State Report ─────────────────────────────────────────────
// Returns one sheet per asset type showing the CURRENT full row for every
// asset that was touched (CREATE / UPDATE / DELETE / RESTORE) in the period.
auditRouter.get('/weekly-report', async (req, res) => {
  const { from, to } = req.query as Record<string, string>;

  // 1. Audit rows in range
  const q = db('audit_logs')
    .leftJoin('users', 'audit_logs.user_id', 'users.id')
    .whereIn('audit_logs.entity_type', WEEKLY_ENTITY_TYPES)
    .whereIn('audit_logs.action', ['CREATE', 'UPDATE', 'DELETE', 'RESTORE'])
    .select('audit_logs.entity_type', 'audit_logs.entity_id', 'audit_logs.action',
            'audit_logs.created_at', 'users.full_name as user_full_name', 'users.username');
  if (from) q.where('audit_logs.created_at', '>=', from);
  if (to)   q.where('audit_logs.created_at', '<=', `${to} 23:59:59`);
  const auditRows = await q as any[];

  // 2. Collect unique asset ids per type + last-change info per asset
  const idsByType = new Map<string, Set<number>>();
  const byType    = new Map<string, any[]>();      // all audit rows grouped by entity_type
  const lastChangeByAsset = new Map<string, { date: string; user: string; action: string }>();
  for (const row of auditRows) {
    if (!row.entity_id) continue;
    const key = `${row.entity_type}:${row.entity_id}`;
    if (!idsByType.has(row.entity_type)) idsByType.set(row.entity_type, new Set());
    idsByType.get(row.entity_type)!.add(Number(row.entity_id));
    if (!byType.has(row.entity_type)) byType.set(row.entity_type, []);
    byType.get(row.entity_type)!.push(row);
    // Keep the most-recent change record per asset
    const existing = lastChangeByAsset.get(key);
    if (!existing || new Date(row.created_at) > new Date(existing.date)) {
      lastChangeByAsset.set(key, {
        date: row.created_at,
        user: row.user_full_name || row.username || '',
        action: row.action,
      });
    }
  }

  if (idsByType.size === 0) {
    res.status(404).json({ error: 'No changes found in the selected date range.' });
    return;
  }

  // 3. Lookup maps
  const [vendors, locations, departments, employees, statuses] = await Promise.all([
    db('vendors').select('id', 'name'),
    db('locations').select('id', 'name'),
    db('departments').select('id', 'name'),
    db('employees').select('id', 'full_name', 'employee_code'),
    db('asset_statuses').select('id', 'name'),
  ]);
  const vendorMap   = new Map((vendors   as any[]).map((r: any) => [r.id, r.name]));
  const locationMap = new Map((locations as any[]).map((r: any) => [r.id, r.name]));
  const deptMap     = new Map((departments as any[]).map((r: any) => [r.id, r.name]));
  const empMap      = new Map((employees  as any[]).map((r: any) => [r.id, { name: r.full_name, code: r.employee_code }]));
  const statusMap   = new Map((statuses   as any[]).map((r: any) => [r.id, r.name]));

  // 4. Fetch current asset rows per type
  const assetsByType = new Map<string, Map<number, any>>();
  for (const [type, idSet] of idsByType.entries()) {
    const table = ASSET_TABLE_MAP[type];
    if (!table) continue;
    const rows = await db(table).whereIn('id', Array.from(idSet)) as any[];
    const map = new Map<number, any>();
    for (const r of rows) map.set(r.id, r);
    assetsByType.set(type, map);
  }

  // 5. Styles — premium design
  const B0  = { style: 'thin',   color: { rgb: 'E2E8F0' } }; // subtle inner border
  const B1  = { style: 'thin',   color: { rgb: '94A3B8' } }; // normal border
  const B2  = { style: 'medium', color: { rgb: '475569' } }; // outer / accent border
  const CB  = { top: B0, bottom: B0, left: B0, right: B0 };   // cell border
  const OB  = { top: B2, bottom: B2, left: B2, right: B2 };   // outer border
  const LB  = { top: B0, bottom: B0, left: B2, right: B0 };   // left-accent border

  // ── Title banner — deep navy with large white text
  const S_TITLE = {
    font:      { bold: true, sz: 18, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
    fill:      { patternType: 'solid', fgColor: { rgb: '0F172A' } },
    alignment: { horizontal: 'left', vertical: 'center', indent: 2 },
    border:    OB,
  };
  // ── Subtitle row — dark slate text on light background
  const S_SUBTITLE = {
    font:      { bold: true, sz: 11, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
    fill:      { patternType: 'solid', fgColor: { rgb: '1E3A8A' } },
    alignment: { horizontal: 'left', vertical: 'center', indent: 2 },
    border:    { top: B0, bottom: B1, left: B2, right: B2 },
  };
  // ── Meta info — period / generated
  const S_META = {
    font:      { sz: 10, color: { rgb: '334155' }, name: 'Calibri', italic: true },
    fill:      { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
    alignment: { horizontal: 'left', vertical: 'center', indent: 2 },
    border:    { top: B0, bottom: B1, left: B2, right: B2 },
  };
  // ── Column headers — asset info (blue) vs change info (teal)
  const S_HDR_ASSET = {
    fill:      { patternType: 'solid', fgColor: { rgb: '1E40AF' } },
    font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border:    { top: B1, bottom: B2, left: B0, right: B0 },
  };
  const S_HDR_CHANGE = {
    fill:      { patternType: 'solid', fgColor: { rgb: '0F766E' } },
    font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border:    { top: B1, bottom: B2, left: B0, right: B0 },
  };
  // ── Data rows — clean white / very pale blue alternating
  const S_ROW_EVEN = {
    fill:      { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
    font:      { sz: 10, name: 'Calibri', color: { rgb: '1E293B' } },
    alignment: { vertical: 'center', wrapText: false },
    border:    CB,
  };
  const S_ROW_ODD = {
    fill:      { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } },
    font:      { sz: 10, name: 'Calibri', color: { rgb: '1E293B' } },
    alignment: { vertical: 'center', wrapText: false },
    border:    CB,
  };
  const S_BOLD_EVEN = { ...S_ROW_EVEN, font: { ...S_ROW_EVEN.font, bold: true, color: { rgb: '0F172A' } } };
  const S_BOLD_ODD  = { ...S_ROW_ODD,  font: { ...S_ROW_ODD.font,  bold: true, color: { rgb: '0F172A' } } };
  // Name cell with left accent border (blue bar)
  const S_NAME_EVEN = { ...S_BOLD_EVEN, border: { ...CB, left: { style: 'medium', color: { rgb: '3B82F6' } } } };
  const S_NAME_ODD  = { ...S_BOLD_ODD,  border: { ...CB, left: { style: 'medium', color: { rgb: '3B82F6' } } } };

  // Action badge — each action gets its own background colour
  const ACTION_STYLE: Record<string, { bg: string; fg: string }> = {
    CREATE:  { bg: 'DCFCE7', fg: '14532D' },
    UPDATE:  { bg: 'DBEAFE', fg: '1E3A8A' },
    DELETE:  { bg: 'FEE2E2', fg: '7F1D1D' },
    RESTORE: { bg: 'F3E8FF', fg: '4C1D95' },
  };
  const ACTION_FONT: Record<string, string> = { CREATE: '14532D', UPDATE: '1E3A8A', DELETE: '7F1D1D', RESTORE: '4C1D95' };

  // Summary sheet specific styles
  const S_SUM_HDR = {
    fill:      { patternType: 'solid', fgColor: { rgb: '1E3A8A' } },
    font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' },
    border:    { top: B2, bottom: B2, left: B0, right: B0 },
  };
  const S_SUM_TOTAL = {
    fill:      { patternType: 'solid', fgColor: { rgb: '0F172A' } },
    font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' },
    border:    OB,
  };
  const S_LABEL_EVEN = { ...S_ROW_EVEN, border: { ...CB, left: { style: 'medium', color: { rgb: '6366F1' } } } };
  const S_LABEL_ODD  = { ...S_ROW_ODD,  border: { ...CB, left: { style: 'medium', color: { rgb: '6366F1' } } } };

  const fmtDate = (v: any) => {
    if (!v) return '';
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
  };
  const BOOL_KEYS = new Set(['is_under_warranty', 'hardening_status', 'patching_status', 'data_wiped', 'is_recording_enabled']);
  const DATE_KEYS = new Set(['warranty_expiry_date', 'eol_date', 'created_at', 'updated_at']);

  const cell = (v: any, s: any, overrideFont?: any) => ({
    v: v == null ? '' : String(v),
    t: 's',
    s: overrideFont ? { ...s, font: { ...s.font, ...overrideFont } } : s,
  });

  const now2 = new Date();
  const reportPeriod = (from && to) ? `${from} to ${to}` : from ? `from ${from}` : to ? `up to ${to}` : 'All time';
  const generatedAt = now2.toLocaleString('en-GB');

  // Change-info columns appended at the end
  const LAST_CHANGE_COLS = [
    { key: '__last_change_date__', label: 'Last Changed' },
    { key: '__last_changed_by__', label: 'Changed By' },
    { key: '__last_action__',     label: 'Action' },
  ];

  const wb = XLSX.utils.book_new();

  // ── Fetch consumable transactions (assigned / returned) in the date range ──
  const consumableTxQ = db('consumable_transactions as ct')
    .join('consumable_items as ci', 'ct.consumable_item_id', 'ci.id')
    .leftJoin('employees as e', 'ct.employee_id', 'e.id')
    .leftJoin('users as u', 'ct.performed_by_user_id', 'u.id')
    .whereIn('ct.transaction_type', ['assigned', 'returned'])
    .select(
      'ci.name as item_name', 'ci.category', 'ci.unit',
      'ct.transaction_type', 'ct.quantity', 'ct.transaction_date', 'ct.notes',
      'e.full_name as employee_name', 'e.employee_code',
      'u.full_name as performed_by',
    )
    .orderBy('ct.transaction_date', 'asc');
  if (from) consumableTxQ.where('ct.transaction_date', '>=', from);
  if (to)   consumableTxQ.where('ct.transaction_date', '<=', to);
  const consumableTxRows = await consumableTxQ as any[];

  // ── Summary sheet ─────────────────────────────────────────────────────────
  const summaryRows: any[][] = [
    [{ v: '  IT Asset — Weekly Status Report', t: 's', s: S_TITLE }],
    [{ v: `  Period: ${reportPeriod}`, t: 's', s: S_SUBTITLE }],
    [{ v: `  Generated: ${generatedAt}`, t: 's', s: S_META }],
    [
      { v: 'Asset Type',     t: 's', s: S_SUM_HDR },
      { v: 'Assets Changed', t: 's', s: S_SUM_HDR },
      { v: 'Created',        t: 's', s: S_SUM_HDR },
      { v: 'Updated',        t: 's', s: S_SUM_HDR },
      { v: 'Deleted',        t: 's', s: S_SUM_HDR },
    ],
  ];
  let grandTotal = 0;
  let sumRowIdx = 0;
  for (const type of WEEKLY_ENTITY_TYPES) {
    const idSet = idsByType.get(type);
    if (!idSet || idSet.size === 0) continue;
    const cfg = ENTITY_TYPES[type];
    const typeRows = (byType.get(type) || []) as any[];
    const counts = { CREATE: 0, UPDATE: 0, DELETE: 0, RESTORE: 0 } as Record<string, number>;
    typeRows.forEach((r: any) => { if (r.action in counts) counts[r.action]++; });
    grandTotal += idSet.size;
    const s  = sumRowIdx % 2 === 0 ? S_LABEL_EVEN : S_LABEL_ODD;
    const sn = sumRowIdx % 2 === 0 ? S_ROW_EVEN   : S_ROW_ODD;
    sumRowIdx++;
    summaryRows.push([
      cell(cfg?.displayName || type, s),
      cell(idSet.size, { ...sn, font: { ...sn.font, bold: true, color: { rgb: '1E3A8A' } }, alignment: { horizontal: 'center', vertical: 'center' } }),
      cell(counts.CREATE  > 0 ? counts.CREATE  : '', { ...sn, font: { ...sn.font, bold: true, color: { rgb: '14532D' } }, fill: { patternType: 'solid', fgColor: { rgb: counts.CREATE  > 0 ? 'DCFCE7' : sn.fill.fgColor.rgb } }, alignment: { horizontal: 'center', vertical: 'center' } }),
      cell(counts.UPDATE  > 0 ? counts.UPDATE  : '', { ...sn, font: { ...sn.font, bold: true, color: { rgb: '1E3A8A' } }, fill: { patternType: 'solid', fgColor: { rgb: counts.UPDATE  > 0 ? 'DBEAFE' : sn.fill.fgColor.rgb } }, alignment: { horizontal: 'center', vertical: 'center' } }),
      cell(counts.DELETE  > 0 ? counts.DELETE  : '', { ...sn, font: { ...sn.font, bold: true, color: { rgb: '7F1D1D' } }, fill: { patternType: 'solid', fgColor: { rgb: counts.DELETE  > 0 ? 'FEE2E2' : sn.fill.fgColor.rgb } }, alignment: { horizontal: 'center', vertical: 'center' } }),
    ]);
  }
  if (consumableTxRows.length > 0) {
    const s  = sumRowIdx % 2 === 0 ? S_LABEL_EVEN : S_LABEL_ODD;
    const sn = sumRowIdx % 2 === 0 ? S_ROW_EVEN   : S_ROW_ODD;
    summaryRows.push([
      cell('Consumable Assignments', s),
      cell(consumableTxRows.length, { ...sn, font: { ...sn.font, bold: true, color: { rgb: '0F766E' } }, alignment: { horizontal: 'center', vertical: 'center' } }),
      cell('', sn), cell('', sn), cell('', sn),
    ]);
  }
  summaryRows.push([{ v: '', t: 's', s: { fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } } } }]);
  summaryRows.push([
    cell('  TOTAL ASSETS CHANGED', S_SUM_TOTAL),
    cell(grandTotal, { ...S_SUM_TOTAL, alignment: { horizontal: 'center', vertical: 'center' } }),
    cell('', S_SUM_TOTAL), cell('', S_SUM_TOTAL), cell('', S_SUM_TOTAL),
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  wsSummary['!rows'] = [{ hpt: 36 }, { hpt: 20 }, { hpt: 18 }, { hpt: 24 }];
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
    { s: { r: summaryRows.length - 2, c: 0 }, e: { r: summaryRows.length - 2, c: 4 } },
    { s: { r: summaryRows.length - 1, c: 0 }, e: { r: summaryRows.length - 1, c: 1 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── Per-type asset sheets ──────────────────────────────────────────────────
  for (const type of WEEKLY_ENTITY_TYPES) {
    const idSet = idsByType.get(type);
    if (!idSet || idSet.size === 0) continue;
    const assetMap = assetsByType.get(type) || new Map();
    const cfg = ENTITY_TYPES[type];
    const sheetName = cfg?.displayName || type;
    // Endpoints use a custom ordered column set; all others use common + extras
    const extraCols = EXTRA_COLS[type] || [];
    const assetCols = type === 'endpoint' ? ENDPOINT_COLS : [...COMMON_COLS, ...extraCols];
    const allCols   = [...assetCols, ...LAST_CHANGE_COLS];

    const titleAoa: any[][] = [
      [{ v: `  IT Asset Report — ${sheetName}`, t: 's', s: S_TITLE }],
      [{ v: `  Period: ${reportPeriod}`, t: 's', s: S_SUBTITLE }],
      [{ v: `  ${idSet.size} asset(s) changed   |   Generated: ${generatedAt}`, t: 's', s: S_META }],
      [
        ...assetCols.map((c) => ({ v: c.label, t: 's', s: S_HDR_ASSET })),
        ...LAST_CHANGE_COLS.map((c) => ({ v: c.label, t: 's', s: S_HDR_CHANGE })),
      ],
    ];

    const dataRows = Array.from(idSet).map((assetId, ri) => {
      const asset = assetMap.get(assetId) || {};
      const emp = empMap.get(Number(asset.employee_id));
      const s    = ri % 2 === 0 ? S_ROW_EVEN : S_ROW_ODD;
      const sBold = ri % 2 === 0 ? S_BOLD_EVEN : S_BOLD_ODD;
      const chg  = lastChangeByAsset.get(`${type}:${assetId}`);
      const action = chg?.action || '';
      const actionStyle = ACTION_STYLE[action];

      const getVal = (key: string): string => {
        if (key === 'vendor_name')   return vendorMap.get(Number(asset.vendor_id)) ?? '';
        if (key === 'status_name')   return statusMap.get(Number(asset.status_id)) ?? '';
        if (key === 'location_name') return locationMap.get(Number(asset.location_id)) ?? '';
        if (key === 'dept_name')     return deptMap.get(Number(asset.department_id)) ?? '';
        if (key === 'employee_name') return emp?.name ?? '';
        if (key === 'employee_code') return emp?.code ?? '';
        if (key === '__last_change_date__') return chg ? fmtDate(chg.date) : '';
        if (key === '__last_changed_by__')  return chg?.user ?? '';
        if (key === '__last_action__')      return action;
        const raw = asset[key];
        if (raw == null) return '';
        if (BOOL_KEYS.has(key)) return raw ? 'Yes' : 'No';
        if (DATE_KEYS.has(key)) return fmtDate(raw);
        if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}(T|\s|$)/.test(raw)) return fmtDate(raw);
        return String(raw);
      };

      const sName = ri % 2 === 0 ? S_NAME_EVEN : S_NAME_ODD;

      return allCols.map((c) => {
        const v = getVal(c.key);
        // Action cell — coloured background fill per action
        if (c.key === '__last_action__') {
          const as_ = actionStyle || { bg: 'F1F5F9', fg: '475569' };
          return { v, t: 's', s: { ...s, fill: { patternType: 'solid', fgColor: { rgb: as_.bg } }, font: { ...s.font, bold: true, color: { rgb: as_.fg } }, alignment: { horizontal: 'center', vertical: 'center' } } };
        }
        // Last changed date — teal tint
        if (c.key === '__last_change_date__') return cell(v, { ...s, font: { ...s.font, color: { rgb: '0F766E' } }, alignment: { horizontal: 'center', vertical: 'center' } });
        // Changed by — italic
        if (c.key === '__last_changed_by__') return cell(v, { ...s, font: { ...s.font, italic: true } });
        // Asset name — bold with left accent bar
        if (c.key === 'asset_name') return cell(v, sName);
        // Serial number — bold monospace-ish
        if (c.key === 'serial_number') return cell(v, sBold);
        // Deleted asset status — red italic
        if (asset.deleted_at && c.key === 'status_name') return cell(v, { ...s, font: { ...s.font, color: { rgb: '991B1B' }, italic: true } });
        // Status — centered
        if (c.key === 'status_name') return cell(v, { ...s, alignment: { horizontal: 'center', vertical: 'center' } });
        return cell(v, s);
      });
    });

    const colWidths = allCols.map((c, ci) => {
      let max = c.label.length;
      for (const dr of dataRows) {
        const len = String((dr[ci] as any).v ?? '').length;
        if (len > max) max = len;
      }
      return { wch: Math.min(Math.max(max + 2, 10), 50) };
    });

    const ws = XLSX.utils.aoa_to_sheet([...titleAoa, ...dataRows]);
    ws['!cols'] = colWidths;
    ws['!rows'] = [{ hpt: 36 }, { hpt: 20 }, { hpt: 18 }, { hpt: 24 }, ...dataRows.map(() => ({ hpt: 18 }))];
    ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5' }];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: allCols.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: allCols.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: allCols.length - 1 } },
    ];
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  }

  // ── Consumable Assignments sheet ──────────────────────────────────────────
  if (consumableTxRows.length > 0) {
    const TX_TYPE_COLOR: Record<string, string> = { assigned: '1D4ED8', returned: '065F46' };
    const cCols = [
      { key: 'item_name',       label: 'Item Name' },
      { key: 'category',        label: 'Category' },
      { key: 'employee_name',   label: 'Employee' },
      { key: 'employee_code',   label: 'Employee ID' },
      { key: 'transaction_type',label: 'Type' },
      { key: 'quantity',        label: 'Qty' },
      { key: 'unit',            label: 'Unit' },
      { key: 'transaction_date',label: 'Date' },
      { key: 'notes',           label: 'Notes' },
      { key: 'performed_by',    label: 'Performed By' },
    ];
    const cTitleAoa: any[][] = [
      [{ v: '  IT Asset Report — Consumable Assignments', t: 's', s: S_TITLE }],
      [{ v: `  Period: ${reportPeriod}`, t: 's', s: S_SUBTITLE }],
      [{ v: `  ${consumableTxRows.length} transaction(s)   |   Generated: ${generatedAt}`, t: 's', s: S_META }],
      cCols.map((c) => ({ v: c.label, t: 's', s: S_HDR_ASSET })),
    ];
    const cDataRows = consumableTxRows.map((tx: any, ri: number) => {
      const s = ri % 2 === 0 ? S_ROW_EVEN : S_ROW_ODD;
      return cCols.map((c) => {
        const raw = tx[c.key];
        const v = raw == null ? '' : c.key === 'transaction_date' ? fmtDate(raw) : String(raw);
        if (c.key === 'transaction_type') {
          const color = TX_TYPE_COLOR[String(raw)] || '374151';
          const label = raw === 'assigned' ? 'Assigned' : raw === 'returned' ? 'Returned' : String(raw);
          return cell(label, s, { bold: true, color: { rgb: color } });
        }
        if (c.key === 'employee_name') return cell(v, s, { bold: !!v });
        return cell(v, s);
      });
    });
    const cWidths = cCols.map((c, ci) => {
      let max = c.label.length;
      for (const dr of cDataRows) { const len = String((dr[ci] as any).v ?? '').length; if (len > max) max = len; }
      return { wch: Math.min(Math.max(max + 2, 10), 45) };
    });
    const wsC = XLSX.utils.aoa_to_sheet([...cTitleAoa, ...cDataRows]);
    wsC['!cols'] = cWidths;
    wsC['!rows'] = [{ hpt: 36 }, { hpt: 20 }, { hpt: 18 }, { hpt: 24 }, ...cDataRows.map(() => ({ hpt: 18 }))];
    wsC['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5' }];
    wsC['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: cCols.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: cCols.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: cCols.length - 1 } },
    ];
    XLSX.utils.book_append_sheet(wb, wsC, 'Consumable Assignments');
  }

  const fmtFileDate = (d: string) => d.replace(/-/g, '');
  const rangeStr = from && to
    ? `${fmtFileDate(from)}_to_${fmtFileDate(to)}`
    : from ? `from_${fmtFileDate(from)}`
    : to   ? `to_${fmtFileDate(to)}`
    : 'all_time';
  const filename = `weekly_report_${rangeStr}.xlsx`;
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
});

auditRouter.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize || 100)));
  const offset = (page - 1) * pageSize;

  const buildWhere = (q: any) => {
    if (req.query.user_id) q.where('audit_logs.user_id', Number(req.query.user_id));
    if (req.query.entity_type) q.where('audit_logs.entity_type', req.query.entity_type);
    if (req.query.action) q.where('audit_logs.action', req.query.action);
    if (req.query.from) q.where('audit_logs.created_at', '>=', req.query.from);
    if (req.query.to) q.where('audit_logs.created_at', '<=', req.query.to);
    if (req.query.search) {
      const term = `%${req.query.search}%`;
      q.where((sub: any) => {
        sub.where('audit_logs.entity_type', 'like', term)
          .orWhere('users.username', 'like', term)
          .orWhere('users.full_name', 'like', term);
      });
    }
    return q;
  };

  const [rows, countRows] = await Promise.all([
    buildWhere(
      db('audit_logs')
        .leftJoin('users', 'audit_logs.user_id', 'users.id')
        .select(
          'audit_logs.*',
          'users.username',
          'users.full_name as user_full_name',
        ),
    ).orderBy('audit_logs.created_at', 'desc').limit(pageSize).offset(offset),
    (buildWhere(db('audit_logs').leftJoin('users', 'audit_logs.user_id', 'users.id')) as any).count('audit_logs.id as total') as Promise<{ total: number }[]>,
  ]);

  const enriched = await enrichAuditRows(rows);

  res.json({
    data: enriched,
    pagination: {
      page, pageSize,
      total: Number(countRows[0].total),
      totalPages: Math.ceil(Number(countRows[0].total) / pageSize),
    },
  });
});
