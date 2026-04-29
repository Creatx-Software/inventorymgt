import * as XLSX from 'xlsx';
import db from '../config/db';
import {
  upsertVendor, upsertLocation, upsertDepartment, upsertEmployee,
  getStatusId, normVal, parseDate, parseBool,
} from './lookup-upsert.service';

/**
 * Field metadata for each asset type — describes what columns can be imported.
 * `kind` controls how raw cell values are coerced/looked up before insert.
 */
export type FieldKind =
  | 'text' | 'number' | 'date' | 'bool'
  | 'vendor' | 'location' | 'department' | 'employee_name' | 'employee_code' | 'status'
  | 'enum_endpoint_type' | 'enum_app_tier' | 'enum_server_class' | 'enum_server_type' | 'enum_environment';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  /** keywords used by smart auto-mapping */
  aliases?: string[];
}

const COMMON_FIELDS: FieldDef[] = [
  { key: 'serial_number', label: 'Serial Number', kind: 'text', aliases: ['serial', 'asset serial'] },
  { key: 'sap_asset_code', label: 'SAP Asset Code', kind: 'text', aliases: ['sap', 'sap code', 'sap asset'] },
  { key: 'asset_name', label: 'Asset Name', kind: 'text', aliases: ['name', 'asset'] },
  { key: 'vendor_id', label: 'Vendor / Make', kind: 'vendor', aliases: ['make', 'vendor', 'manufacturer'] },
  { key: 'model', label: 'Model', kind: 'text' },
  { key: 'location_id', label: 'Location / Branch', kind: 'location', aliases: ['branch', 'location', 'office', 'site', 'dc'] },
  { key: 'department_id', label: 'Department', kind: 'department', aliases: ['dept'] },
  { key: 'employee_id', label: 'Employee Name', kind: 'employee_name', aliases: ['name of user', 'user', 'assigned to'] },
  { key: 'employee_code', label: 'Employee Code', kind: 'employee_code', aliases: ['employee id', 'emp id', 'emp code'] },
  { key: 'status_id', label: 'Status', kind: 'status', aliases: ['status'] },
  { key: 'po_number', label: 'PO Number', kind: 'text', aliases: ['po', 'purchase order'] },
  { key: 'invoice_number', label: 'Invoice Number', kind: 'text', aliases: ['invoice'] },
  { key: 'remarks', label: 'Remarks', kind: 'text', aliases: ['comments', 'notes'] },
];

export const ASSET_FIELDS: Record<string, FieldDef[]> = {
  endpoint: [
    ...COMMON_FIELDS,
    { key: 'endpoint_type', label: 'Type (Laptop/Desktop/...)', kind: 'enum_endpoint_type', aliases: ['type', 'endpoint type', 'asset type'] },
    { key: 'host_name', label: 'Host Name', kind: 'text', aliases: ['host', 'hostname'] },
    { key: 'asset_code', label: 'Asset Code', kind: 'text' },
    { key: 'mac_address', label: 'MAC Address', kind: 'text', aliases: ['mac'] },
    { key: 'os_name_version', label: 'OS Name & Version', kind: 'text', aliases: ['os', 'operating system'] },
    { key: 'ip_address', label: 'IP Address', kind: 'text', aliases: ['ip'] },
    { key: 'is_under_warranty', label: 'Under Warranty', kind: 'bool', aliases: ['warranty', 'under warranty', 'amc'] },
    { key: 'warranty_expiry_date', label: 'Warranty Expiry', kind: 'date', aliases: ['warranty expiry', 'warranty date'] },
    { key: 'eol_date', label: 'EOL Date', kind: 'date', aliases: ['eol', 'eos', 'end of life'] },
  ],
  monitor: [
    ...COMMON_FIELDS,
    { key: 'host_name', label: 'Host Name', kind: 'text', aliases: ['host', 'hostname'] },
  ],
  mobile_device: [
    ...COMMON_FIELDS,
    { key: 'eid', label: 'EID', kind: 'text' },
    { key: 'mobile_number', label: 'Mobile Number', kind: 'text', aliases: ['phone', 'mobile'] },
    { key: 'sim_number', label: 'SIM Number', kind: 'text', aliases: ['sim'] },
    { key: 'imei_number', label: 'IMEI', kind: 'text', aliases: ['imei'] },
    { key: 'production_year', label: 'Production Year', kind: 'number', aliases: ['year'] },
  ],
  ip_phone: [
    ...COMMON_FIELDS,
    { key: 'mac_address', label: 'MAC Address', kind: 'text', aliases: ['mac'] },
  ],
  server: [
    ...COMMON_FIELDS,
    { key: 'application_name', label: 'Application Name', kind: 'text', aliases: ['application', 'app'] },
    { key: 'can_id', label: 'CAN ID', kind: 'text' },
    { key: 'application_tier', label: 'Application Tier', kind: 'enum_app_tier', aliases: ['tier'] },
    { key: 'server_class', label: 'Server Class (Physical/Virtual)', kind: 'enum_server_class', aliases: ['physical/virtual', 'class'] },
    { key: 'server_type', label: 'Server Type (Web/App/DB)', kind: 'enum_server_type', aliases: ['server type'] },
    { key: 'os_name_version', label: 'OS Name & Version', kind: 'text', aliases: ['os', 'operating system'] },
    { key: 'server_software', label: 'Server Software', kind: 'text', aliases: ['software', 'web/app/db server'] },
    { key: 'managed_by', label: 'Managed By', kind: 'text', aliases: ['managed'] },
    { key: 'ip_address', label: 'IP Address', kind: 'text', aliases: ['ip'] },
    { key: 'host_name', label: 'Host Name', kind: 'text', aliases: ['host', 'hostname'] },
    { key: 'asset_code', label: 'Asset Code', kind: 'text' },
    { key: 'dc_location', label: 'DC Location', kind: 'text', aliases: ['data center', 'dc'] },
    { key: 'environment', label: 'Environment (Prod/FB/DR)', kind: 'enum_environment', aliases: ['env', 'environment'] },
    { key: 'is_under_warranty', label: 'Under Warranty', kind: 'bool', aliases: ['warranty', 'amc'] },
    { key: 'warranty_expiry_date', label: 'Warranty Expiry', kind: 'date' },
    { key: 'eol_date', label: 'EOL Date', kind: 'date', aliases: ['eol', 'eos'] },
    { key: 'hardening_status', label: 'Hardened', kind: 'bool', aliases: ['hardening'] },
    { key: 'patching_status', label: 'Patched', kind: 'bool', aliases: ['patching', 'patch'] },
    { key: 'exception_memo_no', label: 'Exception Memo #', kind: 'text', aliases: ['exception', 'memo'] },
  ],
  printer: [
    ...COMMON_FIELDS,
    { key: 'device_name', label: 'Device Name', kind: 'text', aliases: ['printer name', 'name'] },
    { key: 'host_name', label: 'Host Name', kind: 'text', aliases: ['host', 'hostname'] },
    { key: 'ip_address', label: 'IP Address', kind: 'text', aliases: ['ip'] },
    { key: 'managed_by', label: 'Managed By', kind: 'text' },
    { key: 'eol_date', label: 'EOL Date', kind: 'date', aliases: ['eol', 'eos'] },
  ],
  network_device: [
    ...COMMON_FIELDS,
    { key: 'device_name', label: 'Device Name', kind: 'text', aliases: ['network device name', 'name'] },
    { key: 'host_name', label: 'Host Name', kind: 'text', aliases: ['host', 'hostname'] },
    { key: 'ip_address', label: 'IP Address', kind: 'text', aliases: ['ip'] },
    { key: 'asset_code', label: 'Asset Code', kind: 'text' },
    { key: 'managed_by', label: 'Managed By', kind: 'text' },
    { key: 'warranty_expiry_date', label: 'Warranty Expiry', kind: 'date' },
    { key: 'eol_date', label: 'EOL Date', kind: 'date', aliases: ['eol', 'eos'] },
  ],
  other_asset: [
    ...COMMON_FIELDS,
    { key: 'host_name', label: 'Host Name', kind: 'text', aliases: ['host', 'hostname'] },
  ],
};

export const ASSET_TYPE_TO_TABLE: Record<string, string> = {
  endpoint: 'endpoints',
  monitor: 'monitors',
  mobile_device: 'mobile_devices',
  ip_phone: 'ip_phones',
  server: 'servers',
  printer: 'printers',
  network_device: 'network_devices',
  other_asset: 'other_assets',
};

/**
 * Read xlsx buffer, return: detected headers from first sheet + first 10 sample rows.
 */
export function parseExcelPreview(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = wb.SheetNames;
  const result: { sheet: string; headers: string[]; sampleRows: any[]; totalRows: number }[] = [];
  for (const name of sheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    result.push({
      sheet: name,
      headers,
      sampleRows: rows.slice(0, 10),
      totalRows: rows.length,
    });
  }
  return result;
}

/**
 * Suggest mapping: for each Excel header, find the best matching field.
 */
export function suggestMapping(headers: string[], assetType: string): Record<string, string | null> {
  const fields = ASSET_FIELDS[assetType] || [];
  const mapping: Record<string, string | null> = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  for (const h of headers) {
    const hn = normalize(h);
    let best: { key: string; score: number } | null = null;
    for (const f of fields) {
      const candidates = [normalize(f.label), normalize(f.key), ...(f.aliases || []).map(normalize)];
      for (const c of candidates) {
        if (!c) continue;
        let score = 0;
        if (hn === c) score = 100;
        else if (hn.includes(c) || c.includes(hn)) score = 60 + Math.min(c.length, hn.length);
        if (score > 0 && (!best || score > best.score)) best = { key: f.key, score };
      }
    }
    mapping[h] = best ? best.key : null;
  }
  return mapping;
}

/**
 * Apply field-kind coercion.
 */
async function coerceValue(trx: any, kind: FieldKind, raw: any, ctx: { departmentId?: number | null; locationId?: number | null }): Promise<any> {
  switch (kind) {
    case 'text': return normVal(raw);
    case 'number': return raw == null || raw === '' ? null : Number(raw);
    case 'date': return parseDate(raw);
    case 'bool': return parseBool(raw);
    case 'vendor': return await upsertVendor(trx, raw);
    case 'location': return await upsertLocation(trx, raw);
    case 'department': return await upsertDepartment(trx, raw);
    case 'employee_name': return raw; // resolved later combined with code
    case 'employee_code': return raw; // resolved later combined with name
    case 'status': return await getStatusId(trx, raw);
    case 'enum_endpoint_type': {
      const v = (normVal(raw) || '').toLowerCase();
      if (v.includes('laptop')) return 'Laptop';
      if (v.includes('desktop')) return 'Desktop';
      if (v.includes('scan')) return 'Scanner';
      return 'Other';
    }
    case 'enum_app_tier': {
      const v = normVal(raw);
      return v && ['0', '1', '2', '3', '4'].includes(v) ? v : null;
    }
    case 'enum_server_class': {
      const v = (normVal(raw) || '').toLowerCase();
      if (v.includes('physical')) return 'Physical';
      if (v.includes('virtual')) return 'Virtual';
      return null;
    }
    case 'enum_server_type': {
      const v = (normVal(raw) || '').toLowerCase();
      if (v.includes('web')) return 'Web';
      if (v.includes('app')) return 'App';
      if (v.includes('db')) return 'DB';
      if (v) return 'Other';
      return null;
    }
    case 'enum_environment': {
      const v = (normVal(raw) || '').toLowerCase();
      if (v.includes('prod')) return 'Prod';
      if (v.includes('dr')) return 'DR';
      if (v.includes('fb')) return 'FB';
      return null;
    }
  }
}

async function generatePlaceholderSerial(trx: any, assetType: string): Promise<string> {
  const prefix = `N/A-${assetType}-`;
  const last = await trx('serial_registry')
    .where('serial_number', 'like', `${prefix}%`)
    .orderBy('id', 'desc')
    .first();
  let next = 1;
  if (last) {
    const m = String(last.serial_number).match(/-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(next).padStart(5, '0')}`;
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  duplicates: number;
  errors: { row: number; error: string }[];
}

/**
 * Run an import. mapping: Excel header → field key (or null to skip).
 * dryRun = preview only, rolls back at the end.
 */
export async function executeImport(args: {
  buffer: Buffer;
  sheetName: string;
  assetType: string;
  mapping: Record<string, string | null>;
  dryRun: boolean;
}): Promise<ImportResult> {
  const wb = XLSX.read(args.buffer, { type: 'buffer' });
  const ws = wb.Sheets[args.sheetName];
  if (!ws) throw new Error(`Sheet "${args.sheetName}" not found`);
  const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });

  const fields = ASSET_FIELDS[args.assetType];
  if (!fields) throw new Error(`Unknown asset type: ${args.assetType}`);
  const fieldByKey = new Map(fields.map((f) => [f.key, f]));
  const table = ASSET_TYPE_TO_TABLE[args.assetType];

  const result: ImportResult = { inserted: 0, skipped: 0, duplicates: 0, errors: [] };

  await db.transaction(async (trx) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || Object.values(row).every((v) => v == null || v === '')) {
        result.skipped++;
        continue;
      }
      try {
        const data: Record<string, any> = {};
        let employeeName: any = null;
        let employeeCode: any = null;

        for (const [excelHeader, fieldKey] of Object.entries(args.mapping)) {
          if (!fieldKey) continue;
          const field = fieldByKey.get(fieldKey);
          if (!field) continue;
          const raw = row[excelHeader];
          if (field.kind === 'employee_name') { employeeName = raw; continue; }
          if (field.kind === 'employee_code') { employeeCode = raw; continue; }
          const value = await coerceValue(trx, field.kind, raw, {
            departmentId: data.department_id,
            locationId: data.location_id,
          });
          data[fieldKey] = value;
        }

        // Resolve employee
        if (employeeName || employeeCode) {
          data.employee_id = await upsertEmployee(trx, employeeName, employeeCode, data.department_id || null, data.location_id || null);
        }

        // Default status if not mapped
        if (!data.status_id) {
          data.status_id = await getStatusId(trx, null);
        }

        // Handle serial
        let serial = normVal(data.serial_number);
        if (!serial) {
          serial = await generatePlaceholderSerial(trx, args.assetType);
        } else {
          const dup = await trx('serial_registry').where({ serial_number: serial }).first();
          if (dup) {
            // Already in registry (either prior import or earlier row in same file) — skip silently
            result.duplicates++;
            continue;
          }
        }
        data.serial_number = serial;

        const [id] = await trx(table).insert(data);
        await trx('serial_registry').insert({
          serial_number: serial,
          asset_type: args.assetType,
          asset_id: id,
        });
        result.inserted++;
      } catch (e: any) {
        result.errors.push({ row: i + 2, error: e.message });
      }
    }
    if (args.dryRun) {
      throw new Error('__DRY_RUN__');
    }
  }).catch((e: any) => {
    if (e.message !== '__DRY_RUN__') throw e;
  });

  return result;
}
