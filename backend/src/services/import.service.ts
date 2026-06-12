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
  | 'text' | 'number' | 'date' | 'bool' | 'time_text' | 'employee_lookup'
  | 'vendor' | 'location' | 'department' | 'employee_name' | 'employee_code' | 'status'
  | 'enum_endpoint_type' | 'enum_app_tier' | 'enum_server_class' | 'enum_server_type' | 'enum_environment'
  | 'ip_array' | 'enum_protocol' | 'enum_direction' | 'enum_rule_type';

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
  const fields = ASSET_FIELDS[assetType] || SIMPLE_FIELDS[assetType] || [];
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
    case 'ip_array': {
      if (!raw) return JSON.stringify([]);
      return JSON.stringify(String(raw).split(',').map((s: string) => s.trim()).filter(Boolean));
    }
    case 'enum_protocol': {
      const v = (normVal(raw) || '').toUpperCase();
      if (v === 'TCP/UDP' || v === 'TCP / UDP') return 'TCP/UDP';
      if (v === 'UDP') return 'UDP';
      return 'TCP';
    }
    case 'enum_direction': {
      const v = (normVal(raw) || '').toLowerCase();
      if (v.includes('bi')) return 'Bi-Directional';
      return 'Uni-Directional';
    }
    case 'enum_rule_type': {
      const v = (normVal(raw) || '').toLowerCase();
      if (v.includes('temp')) return 'Temp';
      return 'Permanent';
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

export type DuplicateMode = 'skip' | 'update' | 'only';

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  duplicates: number;
  errors: { row: number; error: string }[];
}

/**
 * Run an import. mapping: Excel header → field key (or null to skip).
 * dryRun = preview only, rolls back at the end.
 * duplicateMode:
 *   'skip'   — skip rows whose serial already exists (default)
 *   'update' — insert new rows AND update existing rows with Excel data
 *   'only'   — only update existing rows; skip rows with new serials
 */
export async function executeImport(args: {
  buffer: Buffer;
  sheetName: string;
  assetType: string;
  mapping: Record<string, string | null>;
  dryRun: boolean;
  duplicateMode?: DuplicateMode;
}): Promise<ImportResult> {
  const wb = XLSX.read(args.buffer, { type: 'buffer' });
  const ws = wb.Sheets[args.sheetName];
  if (!ws) throw new Error(`Sheet "${args.sheetName}" not found`);
  const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });

  const fields = ASSET_FIELDS[args.assetType];
  if (!fields) throw new Error(`Unknown asset type: ${args.assetType}`);
  const fieldByKey = new Map(fields.map((f) => [f.key, f]));
  const table = ASSET_TYPE_TO_TABLE[args.assetType];

  const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, duplicates: 0, errors: [] };
  const mode: DuplicateMode = args.duplicateMode || 'skip';

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

        // Handle serial + duplicate mode
        let serial = normVal(data.serial_number);

        if (!serial) {
          if (mode === 'only') {
            // No serial → cannot match an existing record
            result.skipped++;
            continue;
          }
          serial = await generatePlaceholderSerial(trx, args.assetType);
        } else {
          const dup = await trx('serial_registry').where({ serial_number: serial }).first();
          if (dup) {
            if (mode === 'skip') {
              result.duplicates++;
              continue;
            }
            // 'update' or 'only': update the existing asset row
            if (dup.asset_type !== args.assetType) {
              result.errors.push({ row: i + 2, error: `Serial "${serial}" belongs to a different asset type (${dup.asset_type})` });
              continue;
            }
            const updateData = { ...data };
            delete updateData.serial_number;
            const existingAsset = await trx(table).where({ id: dup.asset_id }).first();
            await trx(table).where({ id: dup.asset_id }).update({ ...updateData, updated_at: new Date() });
            result.updated++;
            // Re-open assignment if employee changed
            if (data.employee_id && existingAsset?.employee_id !== data.employee_id) {
              await trx('asset_assignments')
                .where({ asset_type: args.assetType, asset_id: dup.asset_id, returned_date: null })
                .update({ returned_date: new Date() });
              await trx('asset_assignments').insert({
                asset_type: args.assetType,
                asset_id: dup.asset_id,
                employee_id: data.employee_id,
                assigned_date: new Date(),
                notes: 'Updated via Excel import',
              });
            }
            continue;
          } else if (mode === 'only') {
            // Serial not found in registry and mode is 'only' → skip new records
            result.skipped++;
            continue;
          }
        }

        // Insert new record
        data.serial_number = serial;
        const [id] = await trx(table).insert(data);
        await trx('serial_registry').insert({
          serial_number: serial,
          asset_type: args.assetType,
          asset_id: id,
        });
        // Open assignment record if assigned to an employee
        if (data.employee_id) {
          await trx('asset_assignments').insert({
            asset_type: args.assetType,
            asset_id: id,
            employee_id: data.employee_id,
            assigned_date: new Date(),
            notes: 'Created via Excel import',
          });
        }
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

// ---------------------------------------------------------------------------
// Simple (non-asset) import — for incidents and activities
// ---------------------------------------------------------------------------

export const SIMPLE_FIELDS: Record<string, FieldDef[]> = {
  firewall: [
    { key: 'application_name',  label: 'Application Name',           kind: 'text',             aliases: ['application', 'app', 'name'] },
    { key: 'sources',           label: 'Sources (comma-separated)',   kind: 'ip_array',         aliases: ['source', 'source ip', 'src'] },
    { key: 'source_nats',       label: 'Source NATs',                 kind: 'ip_array',         aliases: ['source nat', 'src nat', 'snat'] },
    { key: 'destinations',      label: 'Destinations (comma-separated)', kind: 'ip_array',      aliases: ['destination', 'dest', 'dst', 'destination ip'] },
    { key: 'destination_nats',  label: 'Destination NATs',            kind: 'ip_array',         aliases: ['destination nat', 'dst nat', 'dnat'] },
    { key: 'ports',             label: 'Ports',                       kind: 'text',             aliases: ['port', 'port number'] },
    { key: 'protocol',          label: 'Protocol (TCP/UDP/TCP/UDP)',  kind: 'enum_protocol',    aliases: ['proto'] },
    { key: 'direction',         label: 'Direction',                   kind: 'enum_direction',   aliases: ['bi/uni', 'bi-directional', 'uni-directional'] },
    { key: 'rule_type',         label: 'Type (Permanent/Temp)',       kind: 'enum_rule_type',   aliases: ['type', 'rule type', 'temp/permanent'] },
    { key: 'expire_date',       label: 'Expire Date',                 kind: 'date',             aliases: ['expiry', 'expiry date', 'expires'] },
    { key: 'days_window',       label: 'Days Window',                 kind: 'text',             aliases: ['days'] },
    { key: 'time_window',       label: 'Time Window',                 kind: 'text',             aliases: ['time', 'time range'] },
    { key: 'sn_call_number',    label: 'SN Call Number',              kind: 'text',             aliases: ['sn', 'call number', 'ticket', 'ritm'] },
    { key: 'raised_by',         label: 'Engineer Requested',          kind: 'employee_lookup',  aliases: ['engineer', 'requested by', 'raised by', 'by'] },
    { key: 'request_date',      label: 'Request Date',                kind: 'date',             aliases: ['date', 'requested on'] },
    { key: 'description',       label: 'Description',                 kind: 'text',             aliases: ['desc', 'reason', 'justification', 'notes'] },
  ],
  incidents: [
    { key: 'date',                label: 'Date',              kind: 'date',            aliases: ['date'] },
    { key: 'start_time',          label: 'Start Time',        kind: 'time_text',       aliases: ['start', 'start time', 'time from'] },
    { key: 'end_time',            label: 'End Time',          kind: 'time_text',       aliases: ['end', 'end time', 'time to'] },
    { key: 'incident_code',       label: 'Incident Number',   kind: 'text',            aliases: ['code', 'incident', 'number', 'ref'] },
    { key: 'application_impacted',label: 'Application Name',  kind: 'text',            aliases: ['application', 'app', 'application name'] },
    { key: 'problem_statement',   label: 'Description',       kind: 'text',            aliases: ['description', 'problem', 'details'] },
    { key: 'sn_call_number',      label: 'SN / Call Number',  kind: 'text',            aliases: ['sn', 'call number', 'ticket', 'call no'] },
    { key: 'raised_by',           label: 'Raised By',         kind: 'employee_lookup', aliases: ['raised by', 'raised', 'by', 'reporter'] },
  ],
  activities: [
    { key: 'date',          label: 'Date',             kind: 'date',            aliases: ['date'] },
    { key: 'sub_category',  label: 'Sub Category',     kind: 'text',            aliases: ['category', 'sub cat', 'sub_category'] },
    { key: 'ip_address',    label: 'IP Address',       kind: 'text',            aliases: ['ip', 'ip address'] },
    { key: 'device',        label: 'Device',           kind: 'text',            aliases: ['device', 'server', 'switch'] },
    { key: 'sn_call_number',label: 'SN / Call Number', kind: 'text',            aliases: ['sn', 'call number', 'ticket', 'call no'] },
    { key: 'raised_by',     label: 'Raised By',        kind: 'employee_lookup', aliases: ['raised by', 'raised', 'by', 'reporter'] },
    { key: 'description',   label: 'Description',      kind: 'text',            aliases: ['description', 'details', 'notes'] },
  ],
};

function parseTimeText(raw: any): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    const totalSeconds = Math.round(raw * 86400);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const str = String(raw).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    return `${String(parseInt(match[1])).padStart(2, '0')}:${match[2]}:${match[3] ?? '00'}`;
  }
  return null;
}

function parseDateToString(raw: any): string | null {
  const d = parseDate(raw);
  if (!d) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export async function executeSimpleImport(args: {
  buffer: Buffer;
  sheetName: string;
  tableType: 'incidents' | 'activities';
  mapping: Record<string, string | null>;
  dryRun: boolean;
  userId: number;
}): Promise<ImportResult> {
  const wb = XLSX.read(args.buffer, { type: 'buffer' });
  const ws = wb.Sheets[args.sheetName];
  if (!ws) throw new Error(`Sheet "${args.sheetName}" not found`);
  const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });

  const fields = SIMPLE_FIELDS[args.tableType];
  if (!fields) throw new Error(`Unknown table type: ${args.tableType}`);
  const fieldByKey = new Map(fields.map((f) => [f.key, f]));
  const table = args.tableType === 'incidents' ? 'network_incidents' : 'activities';

  const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, duplicates: 0, errors: [] };

  await db.transaction(async (trx) => {
    const allEmployees = await trx('employees').select('id', 'full_name').where('is_active', true);
    const empByName = new Map<string, number>(
      allEmployees.map((e: { id: number; full_name: string }) => [e.full_name.toLowerCase().trim(), e.id]),
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || Object.values(row).every((v) => v == null || v === '')) {
        result.skipped++;
        continue;
      }
      try {
        const data: Record<string, any> = { created_by_user_id: args.userId };

        for (const [excelHeader, fieldKey] of Object.entries(args.mapping)) {
          if (!fieldKey) continue;
          const field = fieldByKey.get(fieldKey);
          if (!field) continue;
          const raw = row[excelHeader];

          let value: any;
          switch (field.kind) {
            case 'date':             value = parseDateToString(raw); break;
            case 'time_text':        value = parseTimeText(raw); break;
            case 'text':             value = normVal(raw); break;
            case 'employee_lookup': {
              const name = normVal(raw);
              value = name ? (empByName.get(name.toLowerCase().trim()) ?? null) : null;
              break;
            }
            default:                 value = normVal(raw);
          }

          if (fieldKey === 'raised_by') {
            data.raised_by_employee_id = value;
          } else {
            data[fieldKey] = value;
          }
        }

        if (args.tableType === 'incidents') {
          const d = data.date as string | null;
          if (d) {
            if (data.start_time) data.start_datetime = `${d} ${data.start_time}`;
            if (data.end_time)   data.end_datetime   = `${d} ${data.end_time}`;
          }
          delete data.start_time;
          delete data.end_time;
        }

        if (!args.dryRun) await trx(table).insert(data);
        result.inserted++;
      } catch (e: any) {
        result.errors.push({ row: i + 2, error: e.message });
      }
    }
    if (args.dryRun) throw new Error('__DRY_RUN__');
  }).catch((e: any) => {
    if (e.message !== '__DRY_RUN__') throw e;
  });

  return result;
}

export async function executeFirewallImport(args: {
  buffer: Buffer;
  sheetName: string;
  mapping: Record<string, string | null>;
  dryRun: boolean;
  userId: number;
}): Promise<ImportResult> {
  const wb = XLSX.read(args.buffer, { type: 'buffer' });
  const ws = wb.Sheets[args.sheetName];
  if (!ws) throw new Error(`Sheet "${args.sheetName}" not found`);
  const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });

  const fields = SIMPLE_FIELDS['firewall'];
  const fieldByKey = new Map(fields.map((f) => [f.key, f]));
  const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, duplicates: 0, errors: [] };

  await db.transaction(async (trx) => {
    const allEmployees = await trx('employees').select('id', 'full_name').where('is_active', true);
    const empByName = new Map<string, number>(
      allEmployees.map((e: { id: number; full_name: string }) => [e.full_name.toLowerCase().trim(), e.id]),
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || Object.values(row).every((v) => v == null || v === '')) {
        result.skipped++;
        continue;
      }
      try {
        const data: Record<string, any> = {
          sources: JSON.stringify([]),
          source_nats: JSON.stringify([]),
          destinations: JSON.stringify([]),
          destination_nats: JSON.stringify([]),
          protocol: 'TCP',
          direction: 'Uni-Directional',
          rule_type: 'Permanent',
        };

        for (const [excelHeader, fieldKey] of Object.entries(args.mapping)) {
          if (!fieldKey) continue;
          const field = fieldByKey.get(fieldKey);
          if (!field) continue;
          const raw = row[excelHeader];

          let value: any;
          switch (field.kind) {
            case 'date':           value = parseDateToString(raw); break;
            case 'text':           value = normVal(raw); break;
            case 'ip_array':       value = JSON.stringify(raw ? String(raw).split(',').map((s: string) => s.trim()).filter(Boolean) : []); break;
            case 'enum_protocol': {
              const v = (normVal(raw) || '').toUpperCase();
              value = v === 'TCP/UDP' || v === 'TCP / UDP' ? 'TCP/UDP' : v === 'UDP' ? 'UDP' : 'TCP';
              break;
            }
            case 'enum_direction': value = (normVal(raw) || '').toLowerCase().includes('bi') ? 'Bi-Directional' : 'Uni-Directional'; break;
            case 'enum_rule_type': value = (normVal(raw) || '').toLowerCase().includes('temp') ? 'Temp' : 'Permanent'; break;
            case 'employee_lookup': {
              const name = normVal(raw);
              value = name ? (empByName.get(name.toLowerCase().trim()) ?? null) : null;
              break;
            }
            default:               value = normVal(raw);
          }

          if (fieldKey === 'raised_by') {
            data.engineer_requested_employee_id = value;
          } else {
            data[fieldKey] = value;
          }
        }

        if (!data.application_name) { result.skipped++; continue; }

        if (!args.dryRun) await trx('firewall_rules').insert(data);
        result.inserted++;
      } catch (e: any) {
        result.errors.push({ row: i + 2, error: e.message });
      }
    }
    if (args.dryRun) throw new Error('__DRY_RUN__');
  }).catch((e: any) => {
    if (e.message !== '__DRY_RUN__') throw e;
  });

  return result;
}
