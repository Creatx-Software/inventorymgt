import { Router } from 'express';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { enrichAuditRows, ENTITY_TYPES } from '../services/entity-resolver.service';
import * as XLSX from 'xlsx';

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

const ASSET_TABLE_MAP: Record<string, string> = {
  endpoint: 'endpoints', monitor: 'monitors', mobile_device: 'mobile_devices',
  ip_phone: 'ip_phones', server: 'servers', printer: 'printers',
  network_device: 'network_devices', other_asset: 'other_assets',
};

// Common columns shown for every asset type
const COMMON_COLS = [
  { key: 'serial_number', label: 'Serial Number' },
  { key: 'asset_name',    label: 'Asset Name' },
  { key: 'model',         label: 'Model' },
  { key: 'vendor_name',   label: 'Vendor' },
  { key: 'status_name',   label: 'Status' },
  { key: 'location_name', label: 'Location' },
  { key: 'dept_name',     label: 'Department' },
  { key: 'employee_name', label: 'Assigned To' },
  { key: 'employee_code', label: 'Employee ID' },
  { key: 'po_number',     label: 'PO Number' },
  { key: 'invoice_number',label: 'Invoice Number' },
  { key: 'remarks',       label: 'Remarks' },
];

const EXTRA_COLS: Record<string, { key: string; label: string }[]> = {
  endpoint:       [{ key: 'host_name', label: 'Host Name' }, { key: 'ip_address', label: 'IP Address' }, { key: 'os_name_version', label: 'OS' }, { key: 'mac_address', label: 'MAC' }, { key: 'endpoint_type', label: 'Type' }],
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

  // ── Styles ────────────────────────────────────────────────────────────────
  const BORDER_THIN = { style: 'thin', color: { rgb: 'D1D5DB' } };
  const CELL_BORDER = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };

  const S_TITLE = {
    font: { bold: true, sz: 14, color: { rgb: '1E3A8A' }, name: 'Calibri' },
    fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };
  const S_META = {
    font: { sz: 10, color: { rgb: '6B7280' }, name: 'Calibri' },
    fill: { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  // Section header styles — asset info vs change info
  const S_HDR_ASSET = {
    fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border: CELL_BORDER,
  };
  const S_HDR_CHANGE = {
    fill: { patternType: 'solid', fgColor: { rgb: '065F46' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border: CELL_BORDER,
  };

  const S_ROW_EVEN = {
    fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
    font: { sz: 10, name: 'Calibri', color: { rgb: '111827' } },
    alignment: { vertical: 'center', wrapText: false },
    border: CELL_BORDER,
  };
  const S_ROW_ODD = {
    fill: { patternType: 'solid', fgColor: { rgb: 'F0F9FF' } },
    font: { sz: 10, name: 'Calibri', color: { rgb: '111827' } },
    alignment: { vertical: 'center', wrapText: false },
    border: CELL_BORDER,
  };

  // Action badge colours (background only — no real cell fill per value in xlsx, so we use font colour)
  const ACTION_FONT: Record<string, string> = {
    CREATE:  '065F46', // green
    UPDATE:  '1D4ED8', // blue
    DELETE:  '991B1B', // red
    RESTORE: '6B21A8', // purple
  };

  const cell = (v: any, s: any, overrideFont?: any) => ({
    v: v == null ? '' : String(v),
    t: 's',
    s: overrideFont ? { ...s, font: { ...s.font, ...overrideFont } } : s,
  });

  const now2 = new Date();
  const reportPeriod = (from && to) ? `${from} to ${to}` : from ? `from ${from}` : to ? `up to ${to}` : 'All time';
  const generatedAt = now2.toLocaleString('en-GB');

  const wb = XLSX.utils.book_new();

  // ── Summary sheet ─────────────────────────────────────────────────────────
  const summaryRows: any[][] = [
    [{ v: 'Asset Changes Report', t: 's', s: { ...S_TITLE, font: { ...S_TITLE.font, sz: 16 } } }],
    [{ v: `Period: ${reportPeriod}`, t: 's', s: S_META }],
    [{ v: `Generated: ${generatedAt}`, t: 's', s: S_META }],
    [],
    [
      { v: 'Asset Type',    t: 's', s: S_HDR_ASSET },
      { v: 'Total Changes', t: 's', s: S_HDR_ASSET },
      { v: 'Created',       t: 's', s: S_HDR_ASSET },
      { v: 'Updated',       t: 's', s: S_HDR_ASSET },
      { v: 'Deleted',       t: 's', s: S_HDR_ASSET },
      { v: 'Restored',      t: 's', s: S_HDR_ASSET },
    ],
  ];
  let grandTotal = 0;
  for (const type of ASSET_ENTITY_TYPES) {
    const rows = byType.get(type) || [];
    if (rows.length === 0) continue;
    const cfg = ENTITY_TYPES[type];
    const counts = { CREATE: 0, UPDATE: 0, DELETE: 0, RESTORE: 0 } as Record<string, number>;
    rows.forEach((r: any) => { if (r.action in counts) counts[r.action]++; });
    grandTotal += rows.length;
    const s = S_ROW_EVEN;
    summaryRows.push([
      cell(cfg?.displayName || type, s),
      cell(rows.length, s),
      cell(counts.CREATE,  s, { color: { rgb: ACTION_FONT.CREATE  }, bold: counts.CREATE  > 0 }),
      cell(counts.UPDATE,  s, { color: { rgb: ACTION_FONT.UPDATE  }, bold: counts.UPDATE  > 0 }),
      cell(counts.DELETE,  s, { color: { rgb: ACTION_FONT.DELETE  }, bold: counts.DELETE  > 0 }),
      cell(counts.RESTORE, s, { color: { rgb: ACTION_FONT.RESTORE }, bold: counts.RESTORE > 0 }),
    ]);
  }
  summaryRows.push([]);
  summaryRows.push([
    cell('TOTAL', { ...S_HDR_ASSET }),
    cell(grandTotal, { ...S_HDR_ASSET }),
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  wsSummary['!rows'] = [{ hpt: 28 }, { hpt: 16 }, { hpt: 16 }];
  wsSummary['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── Per-type sheets ────────────────────────────────────────────────────────
  for (const type of ASSET_ENTITY_TYPES) {
    const rows = byType.get(type);
    if (!rows || rows.length === 0) continue;

    const cfg = ENTITY_TYPES[type];
    const sheetName = cfg?.displayName || type;
    const assetMap = assetsByType.get(type) || new Map();
    const extraCols = EXTRA_COLS[type] || [];
    const assetCols = [...COMMON_COLS, ...extraCols];
    const allCols = [...assetCols, ...CHANGE_COLS];

    // Title rows (3 rows before the header)
    const titleAoa: any[][] = [
      [{ v: `${sheetName} — Changes Report`, t: 's', s: { ...S_TITLE, font: { ...S_TITLE.font, sz: 13 } } }],
      [{ v: `Period: ${reportPeriod}   |   ${rows.length} change(s)`, t: 's', s: S_META }],
      [], // blank spacer
      // Header row — split colours: asset cols vs change cols
      [
        ...assetCols.map((c) => ({ v: c.label, t: 's', s: S_HDR_ASSET })),
        ...CHANGE_COLS.map((c) => ({ v: c.label, t: 's', s: S_HDR_CHANGE })),
      ],
    ];

    const dataRows = rows.map((auditRow: any, ri: number) => {
      const asset = assetMap.get(Number(auditRow.entity_id)) || {};
      const emp = empMap.get(Number(asset.employee_id));
      const s = ri % 2 === 0 ? S_ROW_EVEN : S_ROW_ODD;

      const changeDate = auditRow.created_at ? new Date(auditRow.created_at).toLocaleDateString('en-GB') : '';
      const changeTime = auditRow.created_at ? new Date(auditRow.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
      let changes: any = auditRow.changes;
      try { if (typeof changes === 'string') changes = JSON.parse(changes); } catch {}
      const whatChanged = summariseChanges(changes);
      const action = auditRow.action as string;
      const actionColor = ACTION_FONT[action] || '374151';

      const vals: Record<string, any> = {
        serial_number:    asset.serial_number,
        asset_name:       asset.asset_name,
        model:            asset.model,
        vendor_name:      vendorMap.get(Number(asset.vendor_id)),
        status_name:      statusMap.get(Number(asset.status_id)),
        location_name:    locationMap.get(Number(asset.location_id)),
        dept_name:        deptMap.get(Number(asset.department_id)),
        employee_name:    emp?.name,
        employee_code:    emp?.code,
        po_number:        asset.po_number,
        invoice_number:   asset.invoice_number,
        remarks:          asset.remarks,
        host_name:        asset.host_name,
        ip_address:       asset.ip_address,
        os_name_version:  asset.os_name_version,
        mac_address:      asset.mac_address,
        endpoint_type:    asset.endpoint_type,
        mobile_number:    asset.mobile_number,
        imei_number:      asset.imei_number,
        sim_number:       asset.sim_number,
        phone_number:     asset.phone_number,
        application_name: asset.application_name,
        environment:      asset.environment,
        device_name:      asset.device_name,
        __change_date__:  changeDate,
        __change_time__:  changeTime,
        __changed_by__:   auditRow.user_full_name || auditRow.username || '',
        __action__:       action,
        __what_changed__: whatChanged,
      };

      return allCols.map((c) => {
        const v = vals[c.key];
        // Action column — colour-coded font
        if (c.key === '__action__') return cell(v, s, { bold: true, color: { rgb: actionColor } });
        // Serial number — bold
        if (c.key === 'serial_number') return cell(v, s, { bold: true });
        return cell(v, s);
      });
    });

    // Auto column widths
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
    ws['!rows'] = [{ hpt: 24 }, { hpt: 14 }, { hpt: 6 }, { hpt: 20 }];
    ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5' }];
    // Merge title across all columns
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: allCols.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: allCols.length - 1 } },
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
